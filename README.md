# flyingfawk

![flyingfawk logo](https://raw.githubusercontent.com/expergefacio/flyingfawk/refs/heads/main/static/flyingfawk.jpeg)

## What it is

**flyingfawk** is a dual-pane web GUI for managing files and terminals on an Ubuntu Server.  
⚠️ Alpha/preview release — expect bugs and security limitations.



## Screens

![flyingfawk Screenshot vid](https://raw.githubusercontent.com/expergefacio/flyingfawk/refs/heads/main/screens/vid.jpeg)
![flyingfawk Screenshot term](https://raw.githubusercontent.com/expergefacio/flyingfawk/refs/heads/main/screens/term.jpeg)

## Who it's for

This tool is designed for "power users" — those comfortable working with Linux, servers, and Docker.



## Features

FlyingFawk provides:
- Dual-pane file navigation
- Web-based terminal
- File preview support (images, text, PDFs, etc.)
- Upload, rename, delete, and run user-scripts



## Installation (Ubuntu Server)

### 1. Update & upgrade
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Docker & Compose plugin
```bash
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo systemctl enable --now docker
docker --version
sudo docker run hello-world
```

### 3. Allow non-root Docker usage (non-optional)
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### 4. Allow firewall access
```bash
sudo ufw allow 8096 && sudo ufw enable && sudo ufw reload
```

### 5. Clone the repo
```bash
#this have only been tested running from /home/username/flyingfawk
cd
git clone https://github.com/yourusername/flyingfawk.git
cd flyingfawk
```



## Configuration

Edit the following in your cloned repo before running:

### 🔐 Change login credentials and secret key

Edit `flyingfawk.py`:
```python
USERNAME = os.environ.get("USERNAME")
PASSWORD = os.environ.get("PASSWORD")
SECRET_KEY = os.environ.get("SECRET_KEY")
```
Edit `docker-compose.yml`:
```python
      - FLASK_SECRET_KEY=CHANGETHIS
```

### 📁 Mount volumes
Take note that this is designed to run on the same userid as the host, so if are not running the default 1000:1000, you may want to change this in the Dockerfile.

Also note that the folders /hostroot represents the / on the host, and consistency here could be important in terms of compatibility with other services using the same model, i.e. if a "share publicly" prosject pops up in the future

also thake note that the GUI treats /hostroot as /, but any fileoperations have to prepend /hostroot to the terminal/api/whatnot

Edit `docker-compose.yml`:
```yaml
      # mount the flyingfawk dir as app in the container
      - /home/username/flyingfawk:/app

      # /hostroot will act as the / inside the container
      # whatever you mount there will be visible in the ui
      - /home/username:/hostroot/home/expergefacio
      - /home/username/flyingfawk/userscripts:/hostroot/userscripts

      # pass docker sock, needed for terminal to work
      - /var/run/docker.sock:/var/run/docker.sock
```


## Build & Run

```bash
docker build -t flyingfawk .
docker compose up -d
```

Access via your browser at:  
**http://0.0.0.0:8096**



## Keybinds

| Shortcut         | Action                          |
|------------------|---------------------------------|
| Tab              | Switch between panes            |
| Enter            | Open / preview selected file    |
| Shift + Enter    | Rename selected file            |
| Backspace        | Delete selected file (Meta key) |
| Delete           | Delete selected file            |
| Ctrl + d         | Deselect selected file(s)       |
| Ctrl + a         | Select all                      |
| Ctrl + n         | New file/directory              |
| Ctrl + o         | Open file                       |
| Ctrl + Shift + : | Toggle dotfiles                 |
| Meta + a         | Select all                      |
| Meta + d         | Deselect                        |
| Meta + n         | New file/directory              |
| Meta + o         | Open file                       |
| Shift + :        | Run in terminal                 |
| Shift + B        | Move file                       |
| Shift + C        | Rename                          |
| Shift + M        | Delete                          |
| Shift + N        | New file/directory              |
| Shift + V        | Copy                            |
| Shift + X        | Preview                         |
| Shift + Z        | Toggle file select state        |
| Arrow Keys       | Navigate between files          |
| Ctrl + Arrow     | Move selection across panes     |
| Space            | Select file                     |
| Ctrl + Space     | Toggle file select              |
| Esc              | Close overlay / preview         |




## Security Warning

This is an **alpha preview** and not yet security-hardened.  
Avoid exposing it to the internet or public/open LAN without:
- Reverse proxy with SSL
- Authentication enhancements
- Firewall restrictions



## Design Specs

We are using vanilla js with minimal deps, the deps we have (xterm, socketio, uppy) are bundled so they can be run locally even if internet is down. It also means its open to user-edits without any setup and rebuilding.
Has to work in chorme, and has to run in chrome trough vnc/rd, hence some of the keybinds are non traditional
Terminal can never auto-exec, user must always press enter
File operations happens in terminal, the terminal connects to a tmux-instance on the dockercontainer, and therefore is as persistent and reliable as i can make it, however it is indeniably ugly as fawk🤣
