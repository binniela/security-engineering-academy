def clean_records(records):
    # TODO: implement this drill, then press Run to grade it.
    expected = {'users':[]}
    
    errors = 0
    for entity in records:
        if isinstance(entity, dict):
            expected['users'].append(entity)
            
        else:
            errors += 1
    expected['errors'] = errors
    return expected
