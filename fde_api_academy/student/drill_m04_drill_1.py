def status_action(code):
    # TODO: implement this drill, then press Run to grade it.
    if code == 200:
        return 'accept'
    elif code == 204:
        return 'accept'
    elif code == 429:
        return 'rate-limit backoff'
    elif code == 401 or code == 403:
        return 'refresh credentials'
    elif code > 500:
        return 'retry'
    else:
        return 'escalate'
    
