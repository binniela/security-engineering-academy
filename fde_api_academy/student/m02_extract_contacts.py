def extract_contacts(payload):
    """Extract name, email, and phone from {'users': [...]} API payloads."""
    # TODO: implement in Module 2.
    
    contacts = []
    
    for entity in payload.get('users',[]):
        profile = entity.get('profile',{})
        contact = entity.get('contact',{})
        
        contacts.append({
            'name':profile.get('name'),
            'email':contact.get('email'),
            'phone':contact.get('phone')
            })
            
    return contacts
