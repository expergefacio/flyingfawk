#terminalapi.py
import docker
import socket
import threading

from docker import APIClient
docker_client = APIClient(base_url='unix://var/run/docker.sock')
docker_socket = None
reader_thread = None
stop_reading = threading.Event()

def init_terminal_handlers(socketio):
    from flask import request

    def get_container_id():
        try:
            container_id = socket.gethostname()
            # Optional: you could verify the container exists using inspect_container
            docker_client.inspect_container(container_id)  # raises if not found
            print(f"[get_container_id] Using container ID: {container_id}")
            return container_id
        except Exception as e:
            print(f"[get_container_id] Error: {e}")
            return None

    def read_docker_output():
        global docker_socket
        print("[read_docker_output] Reader thread started.")
        while not stop_reading.is_set() and docker_socket:
            try:
                data = docker_socket.recv(4096)
                if data:
                    print(f"[read_docker_output] Received: {repr(data)}")
                    socketio.emit('terminal_output', {'output': data.decode(errors='ignore')})
            except Exception as e:
                print(f"[read_docker_output] Error: {e}")
                break
        print("[read_docker_output] Reader thread exiting.")

    @socketio.on('connect')
    def handle_connect(auth=None):
        global docker_socket, reader_thread, stop_reading
        print(f"[connect] Client connected: {request.sid}")

        container_id = get_container_id()
        if not container_id:
            socketio.emit('terminal_output', {'output': 'ERROR: Could not get container.\n'})
            return

        try:
            exec_id = docker_client.exec_create(
                container=container_id,
                cmd=['tmux', 'new-session', '-As', 'webterm'],
                tty=True,
                stdin=True,
                stdout=True,
                stderr=True
            )["Id"]

            exec_start_result = docker_client.exec_start(exec_id, socket=True, tty=True)
            docker_socket = exec_start_result._sock
            print(f"[connect] exec_start returned socket: {type(docker_socket)}")

            stop_reading.clear()
            reader_thread = threading.Thread(target=read_docker_output, daemon=True)
            reader_thread.start()

            socketio.emit('terminal_output', {'output': '*** Shell session started ***\n'})
        except Exception as e:
            print(f"[connect] Exception: {e}")
            socketio.emit('terminal_output', {'output': f'ERROR: {str(e)}\n'})

    @socketio.on('terminal_input')
    def handle_terminal_input(data):
        global docker_socket
        try:
            user_input = data.get('input', '')
            print(f"[terminal_input] Received input: {repr(user_input)}")
            if docker_socket:
                docker_socket.send(user_input.encode())
            else:
                socketio.emit('terminal_output', {'output': 'ERROR: No shell session active.\n'})
        except Exception as e:
            print(f"[terminal_input] Error: {e}")
            socketio.emit('terminal_output', {'output': f'ERROR writing to shell: {e}\n'})

    @socketio.on('terminal_prepopulate')
    def handle_terminal_prepopulate(data):
        import time

        print("[terminal_prepopulate] Received prepopulate request")
        command = data.get('command', '').strip()
        cd_path = data.get('cd', '').strip()

        if not command:
            print("[terminal_prepopulate] No command to prepopulate. Ignoring.")
            return

        if any(x in command for x in ['\n', '\r']):
            print("[terminal_prepopulate] Newlines in command are forbidden. Ignoring.")
            return

        container_id = get_container_id()
        if not container_id:
            print("[terminal_prepopulate] Could not retrieve container ID.")
            return

        def is_tmux_ready(timeout=30, interval=0.5):
            check_cmd = "tmux has-session -t webterm"
            elapsed = 0
            while elapsed < timeout:
                exec_id = docker_client.exec_create(
                    container=container_id,
                    cmd=['sh', '-c', check_cmd],
                    tty=False, stdin=False, stdout=True, stderr=True
                )['Id']
                output = docker_client.exec_start(exec_id).decode(errors='ignore')
                inspect = docker_client.exec_inspect(exec_id)
                if inspect['ExitCode'] == 0:
                    print("[is_tmux_ready] tmux session is ready.")
                    return True
                print(f"[is_tmux_ready] tmux not ready yet, retrying in {interval}s...")
                time.sleep(interval)
                elapsed += interval
            print("[is_tmux_ready] Timeout: tmux session was not ready in time.")
            return False

        def exec_tmux_command(cmd):
            try:
                exec_id = docker_client.exec_create(
                    container=container_id,
                    cmd=['sh', '-c', cmd],
                    tty=True, stdin=False, stdout=False, stderr=False
                )['Id']
                docker_client.exec_start(exec_id)
                print(f"[exec_tmux_command] Executed: {cmd}")
                return True
            except Exception as e:
                print(f"[exec_tmux_command] Execution failed: {e}")
                return False

        if not is_tmux_ready():
            print("[terminal_prepopulate] tmux session never became ready, aborting prepopulate.")
            return

        if cd_path:
            cd_cmd = f"tmux send-keys -t webterm C-a C-k 'cd {cd_path}' Enter"
            if not exec_tmux_command(cd_cmd):
                print("[terminal_prepopulate] Failed sending cd command.")
                return

        pre_cmd = f"tmux send-keys -t webterm C-a C-k '{command}'"
        if not exec_tmux_command(pre_cmd):
            print("[terminal_prepopulate] Failed sending prepopulate command.")

    @socketio.on('disconnect')
    def handle_disconnect():
        global docker_socket, stop_reading
        print(f"[disconnect] Client disconnected: {request.sid}")
        stop_reading.set()
        if docker_socket:
            try:
                docker_socket.close()
                print("[disconnect] Docker socket closed.")
            except Exception as e:
                print(f"[disconnect] Error closing socket: {e}")
            docker_socket = None

    print("[terminalapi] Handlers registered via init_terminal_handlers().")
