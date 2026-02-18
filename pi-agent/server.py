#!/usr/bin/env python3
"""
CSS Signage Agent - Flask REST API Server
Provides endpoints for managing the Raspberry Pi signage display
"""

from flask import Flask, jsonify, request, send_from_directory, redirect, send_file, after_this_request
from werkzeug.utils import secure_filename
import subprocess
import psutil
import os
import json
import time
import socket
from datetime import datetime
import tempfile
import glob as globmod

app = Flask(__name__, static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20 MB upload limit

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
PLAYLIST_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads', 'playlist')
MAX_PLAYLIST_IMAGES = 20
ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'}
CONFIG_FILE = '/etc/css/config.json'
FULLPAGEOS_CONFIG = '/boot/firmware/fullpageos.txt'

# Disable caching for all responses
@app.after_request
def add_no_cache_headers(response):
    """Add headers to prevent caching"""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

def load_config():
    """Load configuration from file"""
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        # Return default config if file doesn't exist
        return {
            'name': 'Pi',
            'room': '',
            'display_url': 'file:///opt/css-agent/static/waiting.html',
            'api_port': 5000
        }

def save_config(config):
    """Save configuration to file"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

def get_playlist_config():
    """Return playlist section of config with defaults"""
    config = load_config()
    return {
        'images': config.get('playlist_images', []),
        'display_time': config.get('playlist_display_time', 5),
        'fade_time': config.get('playlist_fade_time', 1),
        'fallback_enabled': config.get('playlist_fallback_enabled', False)
    }

def save_playlist_config(playlist):
    """Merge playlist settings back into main config"""
    config = load_config()
    config['playlist_images'] = playlist.get('images', [])
    config['playlist_display_time'] = playlist.get('display_time', 5)
    config['playlist_fade_time'] = playlist.get('fade_time', 1)
    config['playlist_fallback_enabled'] = playlist.get('fallback_enabled', False)
    save_config(config)

def get_cpu_temp():
    """Get CPU temperature in Celsius"""
    try:
        with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
            temp = int(f.read().strip()) / 1000.0
            return round(temp, 1)
    except:
        return None

def get_ip_address():
    """Get the Pi's IP address"""
    try:
        # Connect to external address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "Unknown"

def restart_chromium():
    """Kill Chromium gracefully (FullPageOS will auto-restart it)"""
    try:
        subprocess.run(['pkill', 'chromium'], check=False, timeout=2)
        time.sleep(1)
    except:
        subprocess.run(['pkill', '-9', 'chromium'], check=False)

def update_display_url(url):
    """Write URL to FullPageOS config and restart browser"""
    with open(FULLPAGEOS_CONFIG, 'w') as f:
        f.write(url + '\n')
    os.sync()
    restart_chromium()

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current Pi status including stats and configuration"""
    config = load_config()

    return jsonify({
        'name': config.get('name', 'Unknown'),
        'room': config.get('room', ''),
        'current_url': config.get('display_url', ''),
        'uptime': int(time.time() - psutil.boot_time()),
        'cpu_percent': psutil.cpu_percent(interval=1),
        'memory_percent': psutil.virtual_memory().percent,
        'temperature': get_cpu_temp(),
        'ip_address': get_ip_address(),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/config', methods=['GET', 'POST'])
def config():
    """Get or update configuration"""
    if request.method == 'GET':
        return jsonify(load_config())
    else:
        # Update configuration
        data = request.json
        config = load_config()

        # Update only provided fields
        if 'name' in data:
            config['name'] = data['name']
        if 'room' in data:
            config['room'] = data['room']
        if 'display_url' in data:
            config['display_url'] = data['display_url']
        if 'api_port' in data:
            config['api_port'] = data['api_port']

        save_config(config)
        return jsonify({'success': True, 'message': 'Configuration updated'})

@app.route('/api/display/url', methods=['POST'])
def set_url():
    """Change the displayed URL and restart browser"""
    data = request.json

    if not data or 'url' not in data:
        return jsonify({'success': False, 'error': 'URL is required'}), 400

    url = data['url']

    # Update configuration
    config = load_config()
    config['display_url'] = url
    save_config(config)

    # Update FullPageOS config and restart browser
    try:
        update_display_url(url)
        return jsonify({'success': True, 'message': f'URL changed to {url}'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/browser/restart', methods=['POST'])
def restart_browser():
    """Restart the Chromium browser"""
    try:
        restart_chromium()
        return jsonify({'success': True, 'message': 'Browser restarted'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/display/screenshot', methods=['GET'])
def get_screenshot():
    """Capture screenshot of current display"""
    try:
        # Use a simple temporary path that the X user can write to
        import time
        screenshot_path = f'/tmp/css-screenshot-{int(time.time())}.png'

        # Try multiple screenshot methods until one works
        result = None
        user = get_chromium_user()

        # Method 1: scrot with explicit env vars (no wrapper script, no $HOME dependency)
        xauthority = f'/home/{user}/.Xauthority'
        try:
            result = subprocess.run(
                ['sudo', '-u', user, 'env', 'DISPLAY=:0', f'XAUTHORITY={xauthority}',
                 'scrot', screenshot_path],
                capture_output=True, timeout=5
            )
        except Exception as e:
            print(f"⚠️ scrot attempt failed: {e}")

        # Method 2: fbgrab - captures framebuffer directly, no X11 auth needed
        if result is None or result.returncode != 0:
            print("ℹ️ scrot failed, trying fbgrab (framebuffer)...")
            try:
                result = subprocess.run(
                    ['fbgrab', screenshot_path],
                    capture_output=True, timeout=5
                )
            except Exception as e:
                print(f"⚠️ fbgrab attempt failed: {e}")

        # Method 3: Try with DISPLAY=:0 as root (some setups allow this)
        if result is None or result.returncode != 0:
            print("ℹ️ fbgrab failed, trying scrot as root...")
            try:
                result = subprocess.run(
                    ['env', 'DISPLAY=:0', 'scrot', screenshot_path],
                    capture_output=True, timeout=5
                )
            except Exception as e:
                print(f"⚠️ scrot-as-root attempt failed: {e}")

        if result.returncode != 0:
            # Log detailed error information
            error_msg = result.stderr.decode('utf-8') if result.stderr else 'No stderr output'
            print(f"❌ Screenshot failed: returncode={result.returncode}, stderr={error_msg}")
            # Cleanup and return error
            if os.path.exists(screenshot_path):
                os.unlink(screenshot_path)
            return jsonify({'success': False, 'error': f'Screenshot capture failed: {error_msg}'}), 500

        # Apply rotation to match what the display actually shows
        # fbgrab captures the raw framebuffer which doesn't include xrandr rotation
        try:
            config = load_config()
            rotation = config.get('screen_rotation', 0)
            if rotation and rotation != 0:
                from PIL import Image
                img = Image.open(screenshot_path)
                # PIL rotate is counter-clockwise, xrandr rotation is CW
                # rotation 90 (right) = rotate image 270° CCW = 90° CW
                # rotation 180 (inverted) = rotate 180°
                # rotation 270 (left) = rotate image 90° CCW = 270° CW
                pil_degrees = {90: 270, 180: 180, 270: 90}.get(rotation, 0)
                if pil_degrees:
                    img = img.rotate(pil_degrees, expand=True)
                    img.save(screenshot_path)
        except ImportError:
            print("⚠️ Pillow not installed, screenshot may not match display rotation")
        except Exception as e:
            print(f"⚠️ Could not rotate screenshot: {e}")

        # Send file with callback to cleanup after sending
        @after_this_request
        def cleanup(response):
            try:
                if os.path.exists(screenshot_path):
                    os.unlink(screenshot_path)
            except:
                pass
            return response

        return send_file(screenshot_path, mimetype='image/png', as_attachment=True,
                        download_name='screenshot.png', max_age=0)

    except subprocess.TimeoutExpired:
        if os.path.exists(screenshot_path):
            os.unlink(screenshot_path)
        return jsonify({'success': False, 'error': 'Screenshot timeout'}), 500
    except FileNotFoundError as e:
        return jsonify({'success': False, 'error': 'Screenshot tool not installed (grim or scrot required)'}), 500
    except Exception as e:
        if 'screenshot_path' in locals() and os.path.exists(screenshot_path):
            os.unlink(screenshot_path)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/display/rotate', methods=['POST'])
def rotate_display():
    """Rotate the display orientation"""
    data = request.json

    if not data or 'rotation' not in data:
        return jsonify({'success': False, 'error': 'Rotation value required (0, 90, 180, or 270)'}), 400

    rotation = data['rotation']
    if rotation not in [0, 90, 180, 270]:
        return jsonify({'success': False, 'error': 'Invalid rotation. Must be 0, 90, 180, or 270'}), 400

    try:
        # Use xrandr to rotate the display via X11
        user = get_chromium_user()

        # Detect primary display (run as the X user)
        result = subprocess.run(
            ['sudo', '-u', user, 'env', 'DISPLAY=:0', 'xrandr'],
            capture_output=True,
            text=True
        )

        # Find connected display (HDMI-1, HDMI-2, etc.)
        display_name = None
        for line in result.stdout.split('\n'):
            if 'connected primary' in line or 'connected' in line:
                display_name = line.split()[0]
                if 'connected' in line:
                    break

        if not display_name:
            return jsonify({'success': False, 'error': 'Could not detect display'}), 500

        rotation_map = {0: 'normal', 90: 'right', 180: 'inverted', 270: 'left'}
        xrandr_rotation = rotation_map[rotation]

        # Apply rotation using xrandr (run as the X user)
        subprocess.run(
            ['sudo', '-u', user, 'env', 'DISPLAY=:0', 'xrandr', '--output', display_name, '--rotate', xrandr_rotation],
            check=True
        )

        # Save rotation to config so screenshot can apply it
        config = load_config()
        config['screen_rotation'] = rotation
        save_config(config)

        return jsonify({
            'success': True,
            'message': f'Display rotated to {rotation}°. Rotation applied immediately and will persist after reboot.',
            'reboot_required': False
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/system/reboot', methods=['POST'])
def reboot():
    """Reboot the Raspberry Pi"""
    try:
        # Schedule reboot in 3 seconds to allow response to be sent
        subprocess.Popen(['sudo', 'shutdown', '-r', '+0'])
        return jsonify({'success': True, 'message': 'System rebooting'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/update', methods=['POST'])
def update():
    """Pull latest code from GitHub repository"""
    try:
        # Use /opt/css (parent repo) or /opt/css-agent if it's a direct git clone
        git_dir = '/opt/css' if os.path.exists('/opt/css/.git') else '/opt/css-agent'

        result = subprocess.run(
            ['git', '-C', git_dir, 'pull'],
            capture_output=True,
            text=True,
            timeout=30
        )

        success = result.returncode == 0
        output = result.stdout + result.stderr

        if success:
            # Restart the agent service in background AFTER response is sent
            # Using Popen so it doesn't block the response
            subprocess.Popen(
                ['bash', '-c', 'sleep 2 && systemctl restart css-agent'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )

        return jsonify({
            'success': success,
            'output': output,
            'message': 'Update successful' if success else 'Update failed'
        })
    except subprocess.TimeoutExpired:
        return jsonify({'success': False, 'error': 'Update timed out'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def netmask_to_cidr(netmask):
    """Convert subnet mask (255.255.255.0) to CIDR prefix length (24)"""
    try:
        # If already a number (CIDR), return as-is
        cidr = int(netmask)
        if 0 <= cidr <= 32:
            return str(cidr)
    except (ValueError, TypeError):
        pass
    # Convert dotted notation to CIDR
    try:
        return str(sum(bin(int(x)).count('1') for x in netmask.split('.')))
    except:
        return '24'  # fallback

def detect_active_interface():
    """Detect the active network interface (eth0, wlan0, etc.)"""
    try:
        result = subprocess.run(
            ['ip', 'route', 'get', '8.8.8.8'],
            capture_output=True, text=True, timeout=5
        )
        # Output like: "8.8.8.8 via 192.168.1.1 dev eth0 src 192.168.1.100"
        for part in result.stdout.split():
            if part == 'dev':
                idx = result.stdout.split().index('dev')
                return result.stdout.split()[idx + 1]
    except:
        pass
    return 'eth0'  # fallback

def has_nmcli():
    """Check if NetworkManager (nmcli) is available"""
    try:
        result = subprocess.run(['which', 'nmcli'], capture_output=True)
        return result.returncode == 0
    except:
        return False

@app.route('/api/network/ip', methods=['POST'])
def configure_network():
    """Configure network IP address (static or DHCP)"""
    data = request.json

    if not data:
        return jsonify({'success': False, 'error': 'Configuration data required'}), 400

    mode = data.get('mode', 'static')  # 'static' or 'dhcp'
    auto_reboot = data.get('auto_reboot', True)  # Auto-reboot by default

    new_ip = None
    interface = detect_active_interface()

    try:
        if has_nmcli():
            # NetworkManager (modern Raspberry Pi OS / FullPageOS)
            # Find the active connection name for this interface
            result = subprocess.run(
                ['nmcli', '-t', '-f', 'NAME,DEVICE', 'connection', 'show', '--active'],
                capture_output=True, text=True, timeout=5
            )
            conn_name = None
            for line in result.stdout.strip().split('\n'):
                parts = line.split(':')
                if len(parts) >= 2 and parts[1] == interface:
                    conn_name = parts[0]
                    break

            if not conn_name:
                conn_name = interface  # fallback to interface name

            if mode == 'dhcp':
                subprocess.run(['nmcli', 'connection', 'modify', conn_name,
                                'ipv4.method', 'auto',
                                'ipv4.addresses', '',
                                'ipv4.gateway', '',
                                'ipv4.dns', ''],
                               check=True, timeout=10)
                new_ip = "DHCP"
            else:
                if not all(k in data for k in ['ip', 'netmask', 'gateway']):
                    return jsonify({'success': False,
                                    'error': 'ip, netmask, and gateway are required for static IP'}), 400

                ip = data['ip']
                cidr = netmask_to_cidr(data['netmask'])
                gateway = data['gateway']
                dns = data.get('dns', '8.8.8.8')
                new_ip = ip

                subprocess.run(['nmcli', 'connection', 'modify', conn_name,
                                'ipv4.method', 'manual',
                                'ipv4.addresses', f'{ip}/{cidr}',
                                'ipv4.gateway', gateway,
                                'ipv4.dns', dns],
                               check=True, timeout=10)

        else:
            # Fallback: dhcpcd (older Raspberry Pi OS)
            if mode == 'dhcp':
                dhcpcd_config = "# Generated by CSS Agent\n# DHCP configuration\n"
                with open('/etc/dhcpcd.conf', 'w') as f:
                    f.write(dhcpcd_config)
                new_ip = "DHCP"
            else:
                if not all(k in data for k in ['ip', 'netmask', 'gateway']):
                    return jsonify({'success': False,
                                    'error': 'ip, netmask, and gateway are required for static IP'}), 400

                ip = data['ip']
                cidr = netmask_to_cidr(data['netmask'])
                gateway = data['gateway']
                dns = data.get('dns', '8.8.8.8')
                new_ip = ip

                dhcpcd_config = f"""# Generated by CSS Agent
# Static IP configuration

interface {interface}
static ip_address={ip}/{cidr}
static routers={gateway}
static domain_name_servers={dns}
"""
                with open('/etc/dhcpcd.conf', 'w') as f:
                    f.write(dhcpcd_config)

        # Switch display to waiting page so the new IP is shown after reboot
        config = load_config()
        config['display_url'] = 'http://localhost:5000/waiting'
        save_config(config)
        try:
            with open(FULLPAGEOS_CONFIG, 'w') as f:
                f.write('http://localhost:5000/waiting\n')
            os.sync()
        except:
            pass

        # Prepare response
        response_data = {
            'success': True,
            'message': 'Network configuration updated.',
            'new_ip': new_ip,
            'reboot_required': True
        }

        if auto_reboot:
            subprocess.Popen(['sudo', 'shutdown', '-r', '+0'])
            response_data['message'] += ' System rebooting.'
            response_data['note'] = f'Reconnect at new IP: {new_ip}'
        else:
            response_data['message'] += ' Reboot required to apply changes.'
            response_data['note'] = 'Manual reboot needed'

        return jsonify(response_data)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/settings/autoupdate', methods=['GET', 'POST'])
def autoupdate_settings():
    """Get or configure auto-update settings"""
    if request.method == 'GET':
        try:
            # Check if auto-update timer is enabled
            result = subprocess.run(
                ['systemctl', 'is-enabled', 'css-auto-update.timer'],
                capture_output=True,
                text=True
            )
            enabled = result.returncode == 0

            return jsonify({
                'enabled': enabled,
                'schedule': '02:50 daily (10 min before reboot)'
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    else:  # POST
        data = request.json
        if not data or 'enabled' not in data:
            return jsonify({'success': False, 'error': 'enabled parameter required'}), 400

        try:
            if data['enabled']:
                subprocess.run(['systemctl', 'enable', 'css-auto-update.timer'], check=True)
                subprocess.run(['systemctl', 'start', 'css-auto-update.timer'], check=True)
                message = 'Auto-update enabled'
            else:
                subprocess.run(['systemctl', 'stop', 'css-auto-update.timer'], check=True)
                subprocess.run(['systemctl', 'disable', 'css-auto-update.timer'], check=True)
                message = 'Auto-update disabled'

            return jsonify({'success': True, 'message': message})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/settings/reboot', methods=['GET', 'POST'])
def reboot_settings():
    """Get or configure daily reboot settings"""
    if request.method == 'GET':
        try:
            # Check if daily reboot timer is enabled
            result = subprocess.run(
                ['systemctl', 'is-enabled', 'css-daily-reboot.timer'],
                capture_output=True,
                text=True
            )
            enabled = result.returncode == 0

            return jsonify({
                'enabled': enabled,
                'schedule': '03:00 daily'
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    else:  # POST
        data = request.json
        if not data or 'enabled' not in data:
            return jsonify({'success': False, 'error': 'enabled parameter required'}), 400

        try:
            # Re-copy timer/service files from repo in case they were updated
            import shutil
            agent_dir = os.path.dirname(os.path.abspath(__file__))
            for f in ['css-daily-reboot.timer', 'css-daily-reboot.service']:
                src = os.path.join(agent_dir, 'systemd', f)
                if os.path.exists(src):
                    shutil.copy2(src, f'/etc/systemd/system/{f}')
            subprocess.run(['systemctl', 'daemon-reload'], check=True)

            if data['enabled']:
                subprocess.run(['systemctl', 'enable', 'css-daily-reboot.timer'], check=True)
                subprocess.run(['systemctl', 'start', 'css-daily-reboot.timer'], check=True)
                message = 'Daily reboot enabled'
            else:
                subprocess.run(['systemctl', 'stop', 'css-daily-reboot.timer'], check=True)
                subprocess.run(['systemctl', 'disable', 'css-daily-reboot.timer'], check=True)
                message = 'Daily reboot disabled'

            return jsonify({'success': True, 'message': message})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/browser/flags', methods=['POST'])
def configure_browser_flags():
    """Configure Chromium flags to disable translate"""
    try:
        configure_chromium_preferences()
        restart_chromium()

        return jsonify({
            'success': True,
            'message': 'Browser flags configured and browser restarted. Translation features should now be disabled.'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/display/image', methods=['POST'])
def upload_image():
    """Upload an image to display on the Pi"""
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image file provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400

    # Validate extension
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({'success': False, 'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'}), 400

    try:
        # Ensure upload directory exists
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # Remove any existing display images
        for old_file in globmod.glob(os.path.join(UPLOAD_FOLDER, 'display-image.*')):
            os.unlink(old_file)

        # Save the new image
        filename = f'display-image.{ext}'
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # Update display URL to show the image
        image_url = 'http://localhost:5000/api/display/image/view'
        config = load_config()
        config['display_url'] = image_url
        save_config(config)

        # Update FullPageOS config and restart browser
        update_display_url(image_url)

        return jsonify({'success': True, 'message': 'Image uploaded and displaying', 'filename': filename})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/display/image/view', methods=['GET'])
def view_image():
    """Serve a fullscreen HTML page displaying the uploaded image"""
    # Find the current display image
    for ext in ALLOWED_IMAGE_EXTENSIONS:
        filepath = os.path.join(UPLOAD_FOLDER, f'display-image.{ext}')
        if os.path.exists(filepath):
            return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="google" content="notranslate">
<style>
* {{ margin: 0; padding: 0; }}
body {{
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}}
img {{
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
}}
</style>
</head>
<body>
<img src="/static/uploads/display-image.{ext}" alt="">
</body>
</html>''', 200, {'Content-Type': 'text/html'}

    return jsonify({'success': False, 'error': 'No image uploaded'}), 404

@app.route('/api/display/image/current', methods=['GET'])
def get_current_image():
    """Get metadata about the currently uploaded image"""
    for ext in ALLOWED_IMAGE_EXTENSIONS:
        filepath = os.path.join(UPLOAD_FOLDER, f'display-image.{ext}')
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            return jsonify({
                'has_image': True,
                'filename': f'display-image.{ext}',
                'size_bytes': size
            })

    return jsonify({'has_image': False})

@app.route('/api/display/image', methods=['DELETE'])
def delete_image():
    """Delete the currently uploaded image"""
    try:
        deleted = False
        for old_file in globmod.glob(os.path.join(UPLOAD_FOLDER, 'display-image.*')):
            os.unlink(old_file)
            deleted = True

        if deleted:
            return jsonify({'success': True, 'message': 'Image deleted'})
        else:
            return jsonify({'success': True, 'message': 'No image to delete'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/display/playlist', methods=['GET', 'POST', 'DELETE'])
def playlist_api():
    """GET: return playlist config. POST: update settings. DELETE: clear all images."""
    if request.method == 'GET':
        return jsonify(get_playlist_config())

    if request.method == 'DELETE':
        playlist = get_playlist_config()
        for filename in playlist['images']:
            filepath = os.path.join(PLAYLIST_FOLDER, filename)
            try:
                if os.path.exists(filepath):
                    os.unlink(filepath)
            except Exception as e:
                print(f'Warning: could not delete {filepath}: {e}')
        playlist['images'] = []
        save_playlist_config(playlist)
        return jsonify({'success': True})

    # POST — update settings
    data = request.json or {}
    playlist = get_playlist_config()
    if 'display_time' in data:
        playlist['display_time'] = max(1, int(data['display_time']))
    if 'fade_time' in data:
        playlist['fade_time'] = max(0, float(data['fade_time']))
    if 'fallback_enabled' in data:
        playlist['fallback_enabled'] = bool(data['fallback_enabled'])
    save_playlist_config(playlist)
    return jsonify({'success': True, 'playlist': playlist})


@app.route('/api/display/playlist/images', methods=['POST'])
def upload_playlist_image():
    """Upload one image to the playlist (max 20)"""
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image file provided'}), 400

    file = request.files['image']
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({'success': False, 'error': 'Invalid file type'}), 400

    playlist = get_playlist_config()
    if len(playlist['images']) >= MAX_PLAYLIST_IMAGES:
        return jsonify({'success': False, 'error': f'Maximum {MAX_PLAYLIST_IMAGES} images reached'}), 400

    os.makedirs(PLAYLIST_FOLDER, exist_ok=True)

    index = len(playlist['images'])
    filename = f'playlist-{index}.{ext}'
    filepath = os.path.join(PLAYLIST_FOLDER, filename)
    file.save(filepath)

    playlist['images'].append(filename)
    save_playlist_config(playlist)

    return jsonify({'success': True, 'index': index, 'filename': filename, 'total': len(playlist['images'])})


@app.route('/api/display/playlist/images/<int:index>', methods=['DELETE'])
def delete_playlist_image(index):
    """Remove one image from the playlist by index"""
    playlist = get_playlist_config()
    if index < 0 or index >= len(playlist['images']):
        return jsonify({'success': False, 'error': 'Invalid index'}), 400

    filename = playlist['images'][index]
    filepath = os.path.join(PLAYLIST_FOLDER, filename)
    try:
        if os.path.exists(filepath):
            os.unlink(filepath)
    except Exception as e:
        print(f'Warning: could not delete file {filepath}: {e}')

    playlist['images'].pop(index)
    save_playlist_config(playlist)
    return jsonify({'success': True, 'total': len(playlist['images'])})


@app.route('/api/display/playlist/activate', methods=['POST'])
def activate_playlist():
    """Switch display to the slideshow page"""
    playlist = get_playlist_config()
    if not playlist['images']:
        return jsonify({'success': False, 'error': 'No images in playlist'}), 400

    playlist_url = 'http://localhost:5000/slideshow'
    config = load_config()
    config['display_url'] = playlist_url
    save_config(config)
    try:
        update_display_url(playlist_url)
        return jsonify({'success': True, 'message': 'Slideshow activated'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/slideshow', methods=['GET'])
def slideshow():
    """Serve a self-contained image playlist slideshow page"""
    playlist = get_playlist_config()
    images = playlist['images']
    display_time = playlist['display_time']
    fade_time = playlist['fade_time']

    if not images:
        return '''<!DOCTYPE html><html><body style="background:#000;color:#fff;display:flex;
align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:24px;">
<p>No images in playlist</p></body></html>''', 200, {'Content-Type': 'text/html'}

    slides_html = '\n'.join(
        f'<div class="slide" id="slide{i}"><img src="/static/uploads/playlist/{img}" alt=""></div>'
        for i, img in enumerate(images)
    )
    display_ms = int(display_time * 1000)
    interval_ms = int((display_time + fade_time) * 1000)

    return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="google" content="notranslate">
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ background: #000; width: 100vw; height: 100vh; overflow: hidden; position: relative; }}
.slide {{
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    transition: opacity {fade_time}s ease-in-out;
}}
.slide.active {{ opacity: 1; }}
img {{ max-width: 100vw; max-height: 100vh; object-fit: contain; }}
</style>
</head>
<body>
{slides_html}
<script>
var slides = document.querySelectorAll('.slide');
var current = 0;
var total = slides.length;
function showSlide(n) {{
    slides.forEach(function(s) {{ s.classList.remove('active'); }});
    slides[n].classList.add('active');
}}
function next() {{
    current = (current + 1) % total;
    showSlide(current);
}}
showSlide(0);
setInterval(next, {interval_ms});
</script>
</body>
</html>''', 200, {{'Content-Type': 'text/html'}}


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/', methods=['GET'])
def index():
    """Root endpoint - redirect to waiting page"""
    return redirect('/waiting')

@app.route('/waiting', methods=['GET'])
def waiting():
    """Serve the waiting page"""
    return send_from_directory('static', 'waiting.html')

@app.route('/offline', methods=['GET'])
def offline():
    """Serve the offline page"""
    return send_from_directory('static', 'offline.html')

@app.route('/api/info', methods=['GET'])
def info():
    """API info endpoint"""
    config = load_config()
    return jsonify({
        'service': 'CSS Signage Agent',
        'version': '1.0.0',
        'name': config.get('name', 'Unknown'),
        'status': 'running'
    })

def get_chromium_user():
    """Detect which user is running Chromium / X session"""
    try:
        # Method 1: Check who's running Chromium
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        for line in result.stdout.split('\n'):
            if 'chromium' in line and 'chrome_crashpad_handler' not in line:
                username = line.split()[0]
                if username != 'root':
                    return username

        # Method 2: Check who's running Xorg
        for line in result.stdout.split('\n'):
            if 'Xorg' in line:
                username = line.split()[0]
                if username != 'root':
                    return username

        # Method 3: Check lightdm auto-login config
        if os.path.exists('/etc/lightdm/lightdm.conf'):
            with open('/etc/lightdm/lightdm.conf', 'r') as f:
                for line in f:
                    if line.strip().startswith('autologin-user='):
                        user = line.strip().split('=', 1)[1]
                        if user:
                            return user

        return 'pi'  # Final fallback
    except:
        return 'pi'

def configure_chromium_preferences():
    """Configure Chromium to disable translation via /etc/chromium.d/ and Preferences JSON"""
    try:
        user = get_chromium_user()

        # ===== PART 1: /etc/chromium.d/ (the correct Debian/Raspberry Pi OS way) =====
        # On Debian-based systems, /usr/bin/chromium-browser is a wrapper that sources
        # all files in /etc/chromium.d/ and passes CHROMIUM_FLAGS to the real binary.
        # This is the ONLY reliable way to pass flags on Raspberry Pi OS.
        chromiumd_dir = '/etc/chromium.d'
        chromiumd_file = os.path.join(chromiumd_dir, '99-css-disable-translate')
        chromiumd_content = '# CSS Signage: Disable Chromium translate popup\nexport CHROMIUM_FLAGS="$CHROMIUM_FLAGS --disable-features=Translate,TranslateUI --disable-translate"\n'

        os.makedirs(chromiumd_dir, exist_ok=True)
        needs_update = True
        if os.path.exists(chromiumd_file):
            with open(chromiumd_file, 'r') as f:
                if f.read() == chromiumd_content:
                    needs_update = False

        if needs_update:
            with open(chromiumd_file, 'w') as f:
                f.write(chromiumd_content)
            print(f"✅ Created {chromiumd_file}")
        else:
            print(f"✅ {chromiumd_file} already configured")

        # ===== PART 2: Patch FullPageOS launch script =====
        # The start script has --disable-features=TranslateUI which overrides our flags.
        # We must change it to --disable-features=Translate,TranslateUI in the script itself.
        import glob as g
        for pattern in [f'/home/{user}/scripts/start_chromium_browser',
                        '/home/*/scripts/start_chromium_browser',
                        '/opt/custompios/scripts/start_chromium_browser',
                        '/opt/fullpageos/scripts/start_chromium_browser']:
            for launch_script in g.glob(pattern):
                if os.path.isfile(launch_script):
                    with open(launch_script, 'r') as f:
                        content = f.read()
                    if '--disable-features=TranslateUI' in content and '--disable-features=Translate,TranslateUI' not in content:
                        content = content.replace('--disable-features=TranslateUI',
                                                  '--disable-features=Translate,TranslateUI')
                        with open(launch_script, 'w') as f:
                            f.write(content)
                        print(f"✅ Patched launch script: {launch_script}")

        # ===== PART 3: Modify Preferences JSON as defense in depth =====
        prefs_dir = f'/home/{user}/.config/chromium/Default'
        prefs_file = os.path.join(prefs_dir, 'Preferences')
        if os.path.exists(prefs_file):
            try:
                with open(prefs_file, 'r') as f:
                    prefs = json.load(f)

                if 'translate' not in prefs or prefs.get('translate', {}).get('enabled') != False:
                    if 'translate' not in prefs:
                        prefs['translate'] = {}
                    prefs['translate']['enabled'] = False

                    with open(prefs_file, 'w') as f:
                        json.dump(prefs, f, indent=2)

                    import pwd
                    uid = pwd.getpwnam(user).pw_uid
                    gid = pwd.getpwnam(user).pw_gid
                    os.chown(prefs_file, uid, gid)

                    print(f"✅ Translate disabled in Preferences JSON: {prefs_file}")
                else:
                    print(f"✅ Preferences JSON already has translate disabled")

            except (json.JSONDecodeError, Exception) as e:
                print(f"⚠️ Warning: Could not update Preferences JSON: {e}")
        else:
            print(f"ℹ️ Preferences file not found yet: {prefs_file}")

    except Exception as e:
        print(f"⚠️ Warning: Could not configure Chromium: {e}")

def start_network_monitor():
    """Monitor internet connectivity and show offline page when network is down.
    When the network comes back, restore the configured display URL."""
    import threading

    def _monitor():
        offline_shown = False
        # Wait for server and browser to be ready before starting checks
        time.sleep(30)

        while True:
            try:
                # Check internet by connecting to a reliable DNS server
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(5)
                s.connect(("8.8.8.8", 53))
                s.close()
                online = True
            except (socket.error, OSError):
                online = False

            if not online and not offline_shown:
                # Network just went down - switch to offline page
                print("Network down - showing offline page")
                try:
                    with open(FULLPAGEOS_CONFIG, 'w') as f:
                        f.write('http://localhost:5000/offline\n')
                    os.sync()
                    restart_chromium()
                    offline_shown = True
                except Exception as e:
                    print(f"Failed to show offline page: {e}")

            elif online and offline_shown:
                # Network restored - switch back to configured URL
                print("Network restored - restoring display URL")
                try:
                    config = load_config()
                    url = config.get('display_url', 'http://localhost:5000/waiting')
                    # Don't restore if the configured URL is the offline page itself
                    if 'offline' in url:
                        url = 'http://localhost:5000/waiting'
                    with open(FULLPAGEOS_CONFIG, 'w') as f:
                        f.write(url + '\n')
                    os.sync()
                    restart_chromium()
                    offline_shown = False
                except Exception as e:
                    print(f"Failed to restore display URL: {e}")

            time.sleep(15)  # Check every 15 seconds

    threading.Thread(target=_monitor, daemon=True).start()

def apply_saved_rotation():
    """Apply saved screen rotation on startup (runs in background thread).
    Retries because X/Chromium may not be ready yet at boot."""
    import threading
    config = load_config()
    rotation = config.get('screen_rotation', 0)
    if not rotation or rotation == 0:
        return

    rotation_map = {90: 'right', 180: 'inverted', 270: 'left'}
    xrandr_rotation = rotation_map.get(rotation)
    if not xrandr_rotation:
        return

    def _apply():
        for attempt in range(20):
            time.sleep(5)
            try:
                user = get_chromium_user()

                # Get display name
                result = subprocess.run(
                    ['sudo', '-u', user, 'env', 'DISPLAY=:0', 'xrandr'],
                    capture_output=True, text=True, timeout=5
                )

                display_name = None
                for line in result.stdout.split('\n'):
                    if 'connected' in line:
                        display_name = line.split()[0]
                        break

                if display_name:
                    subprocess.run(
                        ['sudo', '-u', user, 'env', 'DISPLAY=:0', 'xrandr',
                         '--output', display_name, '--rotate', xrandr_rotation],
                        check=True, timeout=5
                    )
                    print(f"✅ Applied saved rotation: {rotation}°")
                    return
            except Exception as e:
                print(f"⚠️ Rotation attempt {attempt+1}/20: {e}")

        print("❌ Could not apply saved rotation after 20 attempts")

    threading.Thread(target=_apply, daemon=True).start()

if __name__ == '__main__':
    # Configure Chromium to disable translation (flags + Preferences JSON)
    configure_chromium_preferences()

    # Load port from config
    config = load_config()
    port = config.get('api_port', 5000)

    print(f"Starting CSS Signage Agent API server on port {port}")
    print(f"Pi Name: {config.get('name', 'Unknown')}")
    print(f"Display URL: {config.get('display_url', 'Not set')}")

    # Apply saved rotation in background (doesn't block server startup)
    apply_saved_rotation()

    # Start network monitor to show offline page when internet is down
    start_network_monitor()

    # Run Flask server
    # host='0.0.0.0' allows external connections
    app.run(host='0.0.0.0', port=port, debug=False)
