def split_retryable(responses):
    # TODO: implement this drill, then press Run to grade it.
    expected = {'retryable': [], 'non_retryable':[]}
    
    for response in responses:
        status = response.get('status')
        
        if status == 429 or status >= 500:
            expected['retryable'].append(status)
        else:
            expected['non_retryable'].append(status)
    
    return expected
