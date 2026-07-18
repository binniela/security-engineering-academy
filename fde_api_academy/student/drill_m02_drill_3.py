def find_missing_emails(data):
    missing = []
    
    for entity in data['users']:
        contact = entity.get('contact')

        
        if not contact or not contact.get('email'):
            missing.append(entity.get('id'))
        
        
    
    return missing
