def get_access_intervals(records, required):
    
    def get_first(record):
        return record[0]
        
    records.sort(key=get_first)
    
    perms = {'none':1, 'member':2, 'admin':3}
    
    start = None
    end = None
    
    output = []
    
    for record in records:
        
        approved = perms[record[1]] >= perms[required]
        
        if approved:
            if start is None:
                start = record[0]
            end = record[0]
            
        else:
            if start is not None:
                output.append([start,end])
                start = None
                
                
    if start is not None:
        output.append([start,end])
            
            
        
    return output
        
        
        
        
        
        