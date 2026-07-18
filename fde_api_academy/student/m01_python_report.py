def summarize_users(users):
    mist = {'total':0, 'active':0, 'emails':[]}

    for user in users:
        mist['total'] = mist['total'] + 1
        if user['active'] == True:
            mist['active'] = mist['active'] + 1
        mist['emails'].append(user['email'])
        
        
    return mist
        
