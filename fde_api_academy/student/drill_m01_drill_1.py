def normalize_customer_records(records):
    # TODO: implement this drill, then press Run to grade it.
    pictionary = {'users':[]}
    incomplete = 0
    for user in records:
        temp = {}
        name = user.get('name')
        email = user.get('email')
        active = user.get('active')
        incomp = False
        if name:
            temp['name'] = name
        else:
            temp['name'] = 'Unknown'
            incomp = True
            
        if email:
            temp['email'] = email
            
      
        else:
            temp['email'] = ''
            incomp = True
            
        if active:
            temp['active'] = True
        else:
            temp['active'] = False
            
        pictionary['users'].append(temp)
        
        if incomp == True:
            incomplete += 1
            
    pictionary['incomplete'] = incomplete
        
    return pictionary
