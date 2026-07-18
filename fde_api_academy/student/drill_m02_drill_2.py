def flatten_contacts(records):
    # TODO: implement this drill, then press Run to grade it.
    expected = []
    
    for entity in records:
        profile = entity.get('profile') or {}
        company = entity.get('company') or {}
        
        flat_entry = {
        'name' : profile.get('name'),
        'company' : company.get('name'),
        'email' : profile.get('email'),
        'phone' : profile.get('phone')
        }
        expected.append(flat_entry)
        
    return expected
