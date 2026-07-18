def classify_status(code):
    """Classify HTTP status codes into success/auth_error/rate_limited/client_error/server_error."""
    
    # 1. Check for specific highly-priority exceptions first
    if code == 401 or code == 403:
        return "auth_error"
        
    elif code == 429:
        return "rate_limited"
        
    # 2. Check for general ranges using numeric boundaries
    elif 200 <= code <= 299:
        return "success"
        
    elif 400 <= code <= 499:
        return "client_error"
        
    elif 500 <= code <= 599:
        return "server_error"
        
    # 3. Fallback just in case an unexpected code is passed
    else:
        return "unknown_error"