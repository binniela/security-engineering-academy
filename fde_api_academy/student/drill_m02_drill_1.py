def extract_owner_emails(data):
    # TODO: implement this drill, then press Run to grade it.
    emails = []
    
    # 1. Safely handle if 'accounts' is missing or not a list
    for entity in data.get('accounts', []):
        
        # 2. Get the owner value (could be a dict, None, or missing)
        owner = entity.get('owner')
        
        # 3. Only attempt to call .get() if owner is a valid dictionary
        if isinstance(owner, dict):
            email = owner.get('email')
            
            # 4. Only append if the email exists and is not empty
            if email:
                emails.append(email)
                
    # 5. Return the clean list of strings
    return data