#!/usr/bin/env python3
"""
Zero-Day Scanner — CLI Mode
Run: python run_cli.py <target-url>
"""

import sys
import json
import time

# Add scanner to path
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scanner"))

from scanner import run_full_scan

def colored(text, code):
    return f"\033[{code}m{text}\033[0m"

GREEN  = "92"
RED    = "91"
YELLOW = "93"
CYAN   = "96"
GRAY   = "90"
BOLD   = "1"

def print_banner():
    print(colored("""
╔══════════════════════════════════════════════════════════════════╗
║         ZERO-DAY SCANNER FOR E-COMMERCE WEB PORTALS             ║
║         Ethical Hacking Educational Tool  |  By Dhanish          ║
╚══════════════════════════════════════════════════════════════════╝
    """, CYAN))

def log(msg):
    ts = time.strftime("%H:%M:%S")
    print(f"  {colored(ts, GRAY)}  {msg}")

def run_cli(target):
    print_banner()
    print(f"  Target  : {colored(target, CYAN)}")
    print(f"  Started : {colored(time.strftime('%Y-%m-%d %H:%M:%S'), GRAY)}")
    print()

    result = run_full_scan(target, log_cb=log)

    s = result["summary"]
    print()
    print(colored("  ── SUMMARY ─────────────────────────────────────────────────", BOLD))
    print(f"  Subdomains found  : {colored(str(s['total_subdomains']), CYAN)}")
    print(f"  Live subdomains   : {colored(str(s['live_subdomains']), GREEN)}")
    print(f"  Total links       : {colored(str(s['total_links']), CYAN)}")
    print(f"  200 OK            : {colored(str(s['ok']), GREEN)}")
    print(f"  Redirects         : {colored(str(s['redirects']), YELLOW)}")
    print(f"  404 Not Found     : {colored(str(s['not_found']), RED)}")
    print(f"  Server Errors     : {colored(str(s['server_errors']), RED)}")
    print(f"  Timeouts/Errors   : {colored(str(s['timeout_errors']), RED)}")
    print(f"  Forms detected    : {colored(str(s['forms_found']), YELLOW)}")
    print()

    # Subdomains
    print(colored("  ── LIVE SUBDOMAINS ─────────────────────────────────────────", BOLD))
    for sub in result["subdomains"]:
        status = sub.get("status")
        clr = GREEN if status == 200 else YELLOW if status and status < 500 else RED
        print(f"  [{colored(str(status or 'ERR'), clr)}]  {sub['subdomain']}  {colored(sub.get('ip',''), GRAY)}")

    print()

    # Broken links
    broken = [r for r in result["links"] if not r.get("status") or r["status"] in (404,403) or (r.get("status") or 0) >= 500]
    if broken:
        print(colored("  ── BROKEN / RISKY LINKS ────────────────────────────────────", BOLD))
        for r in broken[:30]:
            st = r.get("status") or r.get("error","ERR")
            print(f"  [{colored(str(st), RED)}]  {r['url'][:80]}")
    else:
        print(colored("  ✓ No broken links detected", GREEN))

    print()

    # Export
    out_file = f"scan_result_{int(time.time())}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"  {colored('Full report saved to:', GRAY)} {colored(out_file, CYAN)}")
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_cli.py <target>")
        print("Example: python run_cli.py flipkart.com")
        sys.exit(1)
    run_cli(sys.argv[1])
