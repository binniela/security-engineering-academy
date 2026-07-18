def analyze_profile(user, repos):
    expected = {}
    
    username = user.get('login')
    display_name = user.get('name')
    total = 0
    expected['username'] = username
    expected['display_name'] = display_name
    highest = -1
    most = None
    languages = {}
    for repo in repos:
        stars = repo.get('stargazers_count')
        language = repo.get('language')
        name = repo.get('name')
        if stars > highest:
            highest = stars
            most = name
        total += stars
        if language not in languages:
            languages[language] = 1
        else:
            languages[language] = languages[language] + 1
    expected['total_stars'] = total
    expected['most_starred_repo'] = most
    expected['language_breakdown'] = languages
    
    
    
    
    
    return expected

def fetch_all_pages(fetch_page):
    """Call fetch_page(page_number) until it returns an empty list, then return all records."""
    # TODO: optional challenge helper.
    return fetch_page
