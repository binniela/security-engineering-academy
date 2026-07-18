def flatten_json(data, parent_key='', sep='.'):
    items = {}
    for key, value in data.items():
        
        # Build the path: if there's already a parent key, join them with a dot
        if parent_key:
            new_key = f"{parent_key}{sep}{key}"
        else:
            new_key = key
        
        # If the value is another nested dictionary, dive deeper
        if isinstance(value, dict):
            flattened_sub_dict = flatten_json(value, new_key, sep=sep)
            items.update(flattened_sub_dict)
        else:
            # If it's a regular value (string, int, etc.), save it to the final dict
            items[new_key] = value
            
    return items