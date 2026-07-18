def build_query(params):
    # TODO: implement this drill, then press Run to grade it.
    invalid = (None, '', [])
    exist = dict()
    for k, v in params.items():
        if v not in invalid:
            exist[k] = v
    
        
    return exist
