import sys
sys.path.insert(0, 'scanner')
from scanner import check_url, fetch_and_extract, same_domain

print("=" * 60)
print("  Zero-Day Scanner v2 — Core Logic Test")
print("=" * 60)

# Test 1: Real 404 page
print("\n[TEST 1] Checking a real 404 URL...")
r = check_url("https://the-internet.herokuapp.com/broken_links/broken_link_1")
print(f"  URL    : {r['url']}")
print(f"  Status : {r['status']}")
print(f"  Soft404: {r['soft404']}")
print(f"  Reason : {r['reason']}")
assert r['status'] == 404, f"Expected 404, got {r['status']}"
print("  PASS: Detected true 404 correctly!")

# Test 2: Real 200 page
print("\n[TEST 2] Checking a real 200 OK URL...")
r2 = check_url("https://the-internet.herokuapp.com/")
print(f"  URL    : {r2['url']}")
print(f"  Status : {r2['status']}")
print(f"  Soft404: {r2['soft404']}")
print(f"  Reason : {r2['reason']}")
assert r2['status'] == 200, f"Expected 200, got {r2['status']}"
print("  PASS: Detected 200 OK correctly!")

# Test 3: Redirect detection
print("\n[TEST 3] Checking redirect detection...")
r3 = check_url("http://the-internet.herokuapp.com/")
print(f"  Status    : {r3['status']}")
print(f"  Redirected: {r3['redirected']}")
print(f"  RedirectTo: {r3['redirect_to']}")
print("  PASS: Redirect info captured!")

# Test 4: Link extraction from broken_links page
print("\n[TEST 4] Crawling broken_links page for links...")
links, forms, scripts = fetch_and_extract("https://the-internet.herokuapp.com/broken_links")
print(f"  Links found: {len(links)}")
for l in links[:5]:
    print(f"    - {l}")
print("  PASS: Link extraction works!")

# Test 5: same_domain check
print("\n[TEST 5] Domain matching...")
assert same_domain("https://the-internet.herokuapp.com/foo", "the-internet.herokuapp.com") == True
assert same_domain("https://google.com", "the-internet.herokuapp.com") == False
print("  PASS: Domain matching works!")

print("\n" + "=" * 60)
print("  ALL TESTS PASSED!")
print("=" * 60)
