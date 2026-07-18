def build_repo_report(repos):
    """Summarize repository JSON into totals, top repo, and language counts."""
    # TODO: implement in Module 3.
    expected = {'total_repos':len(repos),'total_stars':0,'top_repo':None,'languages':{}}
    
    top_star = -1
    
    for repo in repos:
        stars = repo.get('stargazers_count', 0)
        name = repo.get('name')
        language = repo.get('language')
        
        if top_star < stars:
            top_star = stars
            expected['top_repo'] = name
            
        expected['total_stars'] = expected['total_stars'] + stars
        

        if language in expected['languages']:
            expected['languages'][language] += 1
        else:
            expected['languages'][language] = 1
            
    return expected
