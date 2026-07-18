def build_text_report(records):
    # TODO: implement this drill, then press Run to grade it.
    
    active = 0
    # Loop through each dictionary inside the 'records' list
    for entity in records:
        # Access the 'active' key inside that specific dictionary
        if entity['active'] == True:
            active += 1
            
    inactive = len(records) - active
    
    # Note the specific casing expected by the grader: 'Total customers', 'Active customers'
    report = (
        f"Total customers: {len(records)}\n"
        f"Active customers: {active}\n"
        f"Inactive customers: {inactive}"
    )
    
    
    return report