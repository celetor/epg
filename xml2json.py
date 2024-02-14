import xmltodict
import json

with open('./xml/e.xml', 'r', encoding='utf-8') as f:
    xml_data = f.read()

xml_dict = xmltodict.parse(xml_data)

channel = xml_dict['tv']['channel']
programme = xml_dict['tv']['programme']

for k in programme:
    for v in channel:
        if v['@id'] == k['@channel']:
            k['@channel'] = v['display-name']['#text']
            break

with open('./json/e.json', 'w', encoding='utf-8') as file:
    json.dump(programme, file, indent=4, ensure_ascii=False)
