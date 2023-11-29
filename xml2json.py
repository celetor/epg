import xmltodict
import json

with open('./xml/e.xml', 'r', encoding='utf-8') as f:
    xml_data = f.read()

xml_dict = xmltodict.parse(xml_data)

with open('./json/e.json', 'w', encoding='utf-8') as file:
    json.dump(xml_dict['tv']['programme'], file, indent=4, ensure_ascii=False)
