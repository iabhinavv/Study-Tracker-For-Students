#!/usr/bin/env python3
"""Optional local server for Study Tracker.

    python3 serve.py     ->  http://localhost:4180/

You do NOT need this. Open index.html and the app runs, reading and writing its
data file in data/ inside this folder. Use this only if you specifically want an
http:// origin — for example to open the app on your phone over the same Wi-Fi:

    HOST=0.0.0.0 python3 serve.py
"""
import functools
import http.server
import os
import socketserver

DIR = os.path.dirname(os.path.abspath(__file__))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "4180"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer((HOST, PORT), functools.partial(Handler, directory=DIR)) as httpd:
    print("Study Tracker at http://localhost:%d/   (ctrl-c to stop)" % PORT, flush=True)
    httpd.serve_forever()
