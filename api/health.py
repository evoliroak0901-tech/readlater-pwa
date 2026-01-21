# Health Check Endpoint
# このファイルをVercelにデプロイすると、/api/health でアクセス可能になります

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            'status': 'ok',
            'message': 'ReadLater is alive! 🎉',
            'timestamp': datetime.now().isoformat(),
            'service': 'readlater-webapp'
        }
        
        self.wfile.write(json.dumps(response).encode())
        return
