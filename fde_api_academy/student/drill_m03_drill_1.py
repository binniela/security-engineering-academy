import json

def summarize_repos(json_string):
    # TODO: implement this drill, then press Run to grade it.
    
    normal = json.loads(json_string)
    expected = {'total':len(normal), 'top':None, 'languages': {}}
    top = -1
    
    for entity in normal:
        name = entity.get('name')
        stars = entity.get('stars')
        language = entity.get('language')
        
        if stars > top:
            top = stars
            expected['top'] = name
            
        if language not in expected['languages']:
            expected['languages'][language] = 1
        else:
            expected['languages'][language] = expected['languages'][language] + 1
        
    
    
    return expected
    