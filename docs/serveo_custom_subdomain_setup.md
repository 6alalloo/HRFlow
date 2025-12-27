# Serveo Custom Subdomain Setup

## Current Status

Your tunnel is running but the custom subdomain `hrflowautomation` requires SSH key registration.

## Option 1: Use Random URL (Works Immediately)

For immediate testing, you can use a random Serveo URL that doesn't require registration.

### Update tunnel-start.sh

Change line 24 in `docker/tunnel-start.sh` from:
```bash
-R hrflowautomation:80:127.0.0.1:4000 \
```

To:
```bash
-R 80:127.0.0.1:4000 \
```

Then restart:
```bash
docker-compose restart tunnel
docker logs hrflow-tunnel --tail 5
```

Look for the random URL in the logs (like `https://abc123-88-201-6-202.serveousercontent.com`)

## Option 2: Register SSH Key for Custom Subdomain (Recommended)

To get a permanent `hrflowautomation` subdomain:

### Step 1: Get Your SSH Public Key

```bash
docker exec hrflow-tunnel cat /root/.ssh/id_rsa.pub
```

### Step 2: Register the Key

Visit the Serveo console and register your key. The URL will be shown in the tunnel logs when you first try to use a custom subdomain. Look for a message like:

```
To request a particular subdomain, you first need to register your SSH public key.
Visit: https://console.serveo.net/ssh/keys?add=SHA256%3A...
```

### Step 3: Login and Register

1. Click the registration URL from the logs
2. Login with Google or GitHub
3. The key will be registered automatically

### Step 4: Restart Tunnel

```bash
docker-compose restart tunnel
```

After registration, the URL `https://hrflowautomation.serveousercontent.com` will work!

## Verify the Tunnel

Once running, test the connection:

```bash
# Get the current URL
docker logs hrflow-tunnel 2>&1 | findstr "Forwarding HTTP"

# Test it
curl https://YOUR_URL_HERE/health
```

Should return: `{"status":"ok","service":"HRFlow backend"}`

## Update Google Form Script

Once you have a stable URL, update `docs/universal_google_form_script.js`:

```javascript
const BACKEND_URL = "https://your-actual-serveo-url-here";
```
