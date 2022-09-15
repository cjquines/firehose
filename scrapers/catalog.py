import json
import re
import requests
from bs4 import BeautifulSoup, Tag

BASE_URL = "http://student.mit.edu/catalog"


def get_old_course_num(html):
    course_title = html.find("h3").get_text()
    # Old course number is on 2nd line if the text is not "(New)"
    title_split = course_title.split('\n')
    if len(title_split) > 2 and title_split[1] != "(New)":
        return title_split[1][1:-1]
    return None


# Level is obtained in sublist_ws.py but not used in combiner
def get_level(html):
    if html.find(attrs={"src": "/icns/under.gif"}):
        return "U"
    elif html.find(attrs={"src": "/icns/grad.gif"}):
        return "G"
    raise Exception("Level not found")


def is_not_offered_next_year(html):
    # determines if it is not offered next year
    if html.find(attrs={"src": "/icns/nonext.gif"}):
        return True
    return False


def is_repeat_allowed(html):
    if html.find(attrs={"src": "/icns/repeat.gif"}):
        return True
    return False


def get_half(html):
    # Returns 1 for 1st half, 2 for 2nd half, False if not a half semester course
    if html.find(text=re.compile("first half of term")):
        return 1
    elif html.find(text=re.compile("second half of term")):
        return 2
    return False


def has_final(html):
    if html.find(text="+final"):
        return True
    return False


def get_course_data(filtered_html):
    no_next = is_not_offered_next_year(filtered_html)
    level = get_level(filtered_html)
    repeat = is_repeat_allowed(filtered_html)
    half = get_half(filtered_html)
    final = has_final(filtered_html)

    course_data = {
        "no_next": no_next,
        "repeat": repeat,
        "half": half,
        "url": "",  # urls are all just empty
        "level": level,
        "final": final,
    }
    if (old_course_num := get_old_course_num(filtered_html)):
        course_data["old_num"] = old_course_num

    return course_data


def get_home_catalog_links():
    r = requests.get(BASE_URL + "/index.cgi")
    html = BeautifulSoup(r.content, "html.parser")
    home_list = html.select_one("td[valign=top][align=left] > ul")
    return [a["href"] for a in home_list.find_all("a", href=True)]


def get_all_catalog_links(initial_hrefs):
    '''
    Find all links from the headers before the subject listings
    '''
    hrefs = []
    for il in initial_hrefs:
        r = requests.get(f"{BASE_URL}/{il}")
        html = BeautifulSoup(r.content, "html.parser")
        # Links should be in the only table in the #contentmini div
        tables = html.find("div", id="contentmini").find_all("table")
        hrefs.append(il)
        for table in tables:
            hrefs.extend(
                [ele["href"] for ele in table.findAll("a", href=True)])
    return hrefs


def get_anchors_with_classname(element):
    '''
    Returns the anchors with the class name if the element itself is one or
    anchors are inside of the element. Otherwise, returns None.
    '''
    anchors = None
    # This is the usualy case, where it's one element
    if element.name == "a" and element.get("href") is None:
        anchors = [element]
    # This is the weird case where the <a> is inside a tag
    # And sometimes the tag has multiple <a> e.g. HST.010 and HST.011
    elif isinstance(element, Tag):
        anchors = element.find_all("a", href=False)
    if not anchors:
        return None

    # We need this because apparently there are anchors with names such as "PIP"
    return list(filter(lambda a: re.match(r"\w+\.\w+", a["name"]), anchors))


def scrape_courses_from_page(courses, href):
    '''Fills courses with course data from the href'''
    r = requests.get(f"{BASE_URL}/{href}")
    # The "html.parser" parses pretty badly
    html = BeautifulSoup(r.content, "lxml")
    classes_content = html.find("table", width="100%", border="0").find("td")

    # For index idx, contents[idx] corresponds to the html content for the courses in
    # course_nums_list[i]. The reason course_nums_list is a list of lists is because
    # there are courses that are ranges but have the same content
    course_nums_list = []
    contents = []
    for ele in classes_content.contents:
        if (anchors := get_anchors_with_classname(ele)):
            new_course_nums = [anchor["name"] for anchor in anchors]
            # This means the course listed is a class range (e.g. 11.S196-11.S199)
            # Therefore, we continue looking for content but also add an extra course_num
            if contents and not contents[-1]:
                course_nums_list[-1].extend(new_course_nums)
                continue
            course_nums_list.append(new_course_nums)
            contents.append([])
        else:
            if not course_nums_list:
                continue
            contents[-1].append(ele)

    assert len(course_nums_list) == len(contents)
    for course_nums, content in zip(course_nums_list, contents):
        filtered_html = BeautifulSoup()
        filtered_html.extend(content)
        course_data = get_course_data(filtered_html)
        for course_num in course_nums:
            courses[course_num] = course_data


def run():
    home_hrefs = get_home_catalog_links()
    all_hrefs = get_all_catalog_links(home_hrefs)
    courses = dict()
    for href in all_hrefs:
        print(f"Scraping page: {href}")
        scrape_courses_from_page(courses, href)
    with open("all_classes", "w") as f:
        json.dump(courses, f)


if __name__ == "__main__":
    run()
