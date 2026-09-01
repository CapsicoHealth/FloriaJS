import requests
import shutil
import os
from pathlib import Path
import json
states=[{"name":"Alabama","abbreviation":"AL"}
       ,{"name":"Alaska","abbreviation":"AK"}
       ,{"name":"Arizona","abbreviation":"AZ"}
       ,{"name":"Arkansas","abbreviation":"AR"}
       ,{"name":"California","abbreviation":"CA"}
       ,{"name":"Colorado","abbreviation":"CO"}
       ,{"name":"Connecticut","abbreviation":"CT"}
       ,{"name":"Delaware","abbreviation":"DE"}
       ,{"name":"Florida","abbreviation":"FL"}
       ,{"name":"Georgia","abbreviation":"GA"}
       ,{"name":"Hawaii","abbreviation":"HI"}
       ,{"name":"Idaho","abbreviation":"ID"}
       ,{"name":"Illinois","abbreviation":"IL"}
       ,{"name":"Indiana","abbreviation":"IN"}
       ,{"name":"Iowa","abbreviation":"IA"}
       ,{"name":"Kansas","abbreviation":"KS"}
       ,{"name":"Kentucky","abbreviation":"KY"}
       ,{"name":"Louisiana","abbreviation":"LA"}
       ,{"name":"Maine","abbreviation":"ME"}
       ,{"name":"Maryland","abbreviation":"MD"}
       ,{"name":"Massachusetts","abbreviation":"MA"}
       ,{"name":"Michigan","abbreviation":"MI"}
       ,{"name":"Minnesota","abbreviation":"MN"}
       ,{"name":"Mississippi","abbreviation":"MS"}
       ,{"name":"Missouri","abbreviation":"MO"}
       ,{"name":"Montana","abbreviation":"MT"}
       ,{"name":"Nebraska","abbreviation":"NE"}
       ,{"name":"Nevada","abbreviation":"NV"}
       ,{"name":"New Hampshire","abbreviation":"NH"}
       ,{"name":"New Jersey","abbreviation":"NJ"}
       ,{"name":"New Mexico","abbreviation":"NM"}
       ,{"name":"New York","abbreviation":"NY"}
       ,{"name":"North Carolina","abbreviation":"NC"}
       ,{"name":"North Dakota","abbreviation":"ND"}
       ,{"name":"Ohio","abbreviation":"OH"}
       ,{"name":"Oklahoma","abbreviation":"OK"}
       ,{"name":"Oregon","abbreviation":"OR"}
       ,{"name":"Pennsylvania","abbreviation":"PA"}
       ,{"name":"Puerto Rico","abbreviation":"PR"}
       ,{"name":"Rhode Island","abbreviation":"RI"}
       ,{"name":"South Carolina","abbreviation":"SC"}
       ,{"name":"South Dakota","abbreviation":"SD"}
       ,{"name":"Tennessee","abbreviation":"TN"}
       ,{"name":"Texas","abbreviation":"TX"}
       ,{"name":"Utah","abbreviation":"UT"}
       ,{"name":"Vermont","abbreviation":"VT"}
       ,{"name":"Virginia","abbreviation":"VA"}
       ,{"name":"Washington","abbreviation":"WA"}
       ,{"name":"West Virginia","abbreviation":"WV"}
       ,{"name":"Wisconsin","abbreviation":"WI"}
       ,{"name":"Wyoming","abbreviation":"WY"}
       ]
print("Start")
if os.path.exists(".\\USA"):
    shutil.rmtree(".\\USA")
os.makedirs(".\\USA")

print("Adding Country->State Data")
URL= 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-united-states-of-america-state/exports/geojson'
response = requests.get(URL)
open(".\\USA\\"+'USA_states.json', "wb").write(response.content)
print("Done")

print("Adding Country-> Couties Data")
URL= 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-united-states-of-america-county/exports/geojson'
response = requests.get(URL)
open(".\\USA\\"+'USA_counties.json', "wb").write(response.content)
print("Done")

"""
print("Adding Country-> Zipcode Data")
URL= 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-united-states-of-america-zcta5/exports/geojson'
response = requests.get(URL)
open(".\\USA\\"+'USA_zipcodes.json', "wb").write(response.content)
print("Done")
"""

print("Creating States folders")
for obj in states:
    name=obj["name"]
    abbr=obj["abbreviation"]
    
    base_path = '.\\USA\\'
    Path(base_path, abbr).mkdir()
print("Done")

print("Adding States-> Counties Data")
for obj in states:
    name=obj["name"]
    abbr=obj["abbreviation"]    
    URL = "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-united-states-of-america-county/exports/geojson?refine=ste_name:"+name
    response = requests.get(URL)
    open("USA/"+abbr+"/"+abbr+'_counties.json', "wb").write(response.content)
    print("   "+abbr)
print("Done")

print("Adding States-> zipcodes Data")
for obj in states:
    name=obj["name"]
    abbr=obj["abbreviation"]    
    URL= 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-united-states-of-america-zcta5/exports/geojson?refine=ste_name:'+name
    response = requests.get(URL)
    open("USA/"+abbr+"/"+abbr+'_zipcodes.json', "wb").write(response.content)
    print("   "+abbr)
print("Done")

def solve(layer):
    for i in range(len(layer)):
        if isinstance(layer[i][0][0], list):
            solve(layer[i])
        else:
            for j in range(len(layer[i])):
                layer[i][j]=[round(layer[i][j][0],4),round(layer[i][j][1],4)]

print("Optimize country-states data")
with open('USA/USA_states.json') as fp:
    statesData = json.load(fp)
                
if statesData:
    for sd in statesData['features']:
        solve(sd['geometry']['coordinates'])
        if 'year' in sd['properties']:
            sd['properties'].pop('year')
        if 'ste_fp_code' in sd['properties']:
            sd['properties'].pop('ste_fp_code')
        if 'ste_gnis_code' in sd['properties']:
            sd['properties'].pop('ste_gnis_code')
        if 'ste_type' in sd['properties']:
            sd['properties'].pop('ste_type')
        if 'ste_area_code' in sd['properties']:
            sd['properties']['cr']=sd['properties']["ste_area_code"]
            sd['properties'].pop('ste_area_code')
        if 'ste_stusps_code' in sd['properties']:
            sd['properties']['stc']=sd['properties']["ste_stusps_code"]
            sd['properties'].pop('ste_stusps_code')
        if 'ste_code' in sd['properties']:
            sd['properties']['s']=[sd['properties']["ste_code"][0],sd['properties']["ste_name"][0]]
            sd['properties'].pop('ste_code')
            sd['properties'].pop('ste_name')
        if 'geo_point_2d' in sd['properties']:
            sd['properties']['latlng']=[round(sd['properties']["geo_point_2d"]['lat'],4),round(sd['properties']["geo_point_2d"]['lon'],4)]
            sd['properties'].pop('geo_point_2d')
    res_bytes = json.dumps(statesData,separators=(',', ':')).encode('utf-8')
    open("USA/"+'USA_states.json', "wb").write(res_bytes)
print("Done")

print("Optimize country-counties data")
countiesData=None
with open('USA/USA_counties.json') as fp:
    countiesData = json.load(fp)
                
if countiesData:
    for cd in countiesData['features']:
        solve(cd['geometry']['coordinates'])
        if 'year' in cd['properties']:
            cd['properties'].pop('year')
        if 'coty_fp_code' in cd['properties']:
            cd['properties'].pop('coty_fp_code')
        if 'coty_gnis_code' in cd['properties']:
            cd['properties'].pop('coty_gnis_code')
        if 'coty_name_long' in cd['properties']:
            cd['properties'].pop('coty_name_long')
        if 'coty_type' in cd['properties']:
            cd['properties'].pop('coty_type')
        if 'coty_area_code' in cd['properties']:
            cd['properties']['cr']=cd['properties']["coty_area_code"]
            cd['properties'].pop('coty_area_code')
        if 'coty_name' in cd['properties']:
            cd['properties']['cn']=[cd['properties']["coty_code"][0],cd['properties']["coty_name"][0]]
            cd['properties'].pop('coty_name')
            cd['properties'].pop('coty_code')
        if 'ste_code' in cd['properties']:
            cd['properties']['s']=[cd['properties']["ste_code"][0],cd['properties']["ste_name"][0]]
            cd['properties'].pop('ste_code')
            cd['properties'].pop('ste_name')
        if 'geo_point_2d' in cd['properties']:
            cd['properties']['latlng']=[round(cd['properties']["geo_point_2d"]['lat'],4),round(cd['properties']["geo_point_2d"]['lon'],4)]
            cd['properties'].pop('geo_point_2d')
    res_bytes = json.dumps(countiesData,separators=(',', ':')).encode('utf-8')
    open('USA/USA_counties.json', "wb").write(res_bytes)
print("Done")

"""
print("Optimize country-zipcodes data")
zipCodeData=None
with open('USA/USA_zipcodes.json') as fp:
    zipCodeData = json.load(fp)
for zd in zipCodeData['features']:
    solve(zd['geometry']['coordinates'])
    if 'year' in zd['properties']:
        zd['properties'].pop('year')
    if 'zcta5_name' in zd['properties']:
        zd['properties'].pop('zcta5_name')
    if 'zcta5_type' in zd['properties']:
        zd['properties'].pop('zcta5_type')
    if 'zcta5_area_code' in zd['properties']:
            zd['properties']['cr']=zd['properties']["zcta5_area_code"]
            zd['properties'].pop('zcta5_area_code')
    if 'zcta5_code' in zd['properties']:
            zd['properties']['zc']=zd['properties']["zcta5_code"][0]
            zd['properties'].pop('zcta5_code')
    if 'geo_point_2d' in zd['properties']:
            zd['properties']['latlng']=[round(zd['properties']["geo_point_2d"]['lat'],4),round(zd['properties']["geo_point_2d"]['lon'],4)]
            zd['properties'].pop('geo_point_2d')
res_bytes = json.dumps(zipCodeData).encode('utf-8')
open('USA/USA_zipcodes.json', "wb").write(res_bytes)
print("Done")
"""

print("Optimize States -> counties and zipcodes")
for st in states:
      abbr=st['abbreviation']
      countiesData=None
      zipCodeData=None
      with open("USA/"+abbr+"/"+abbr+'_counties.json') as fp:
            countiesData = json.load(fp)
      with open("USA/"+abbr+"/"+abbr+'_zipcodes.json') as fp:
            zipCodeData = json.load(fp)
      if countiesData:
        for cd in countiesData['features']:
            solve(cd['geometry']['coordinates'])
            if 'year' in cd['properties']:
                  cd['properties'].pop('year')
            if 'coty_fp_code' in cd['properties']:
                  cd['properties'].pop('coty_fp_code')
            if 'coty_gnis_code' in cd['properties']:
                   cd['properties'].pop('coty_gnis_code')
            if 'coty_name_long' in cd['properties']:
                   cd['properties'].pop('coty_name_long')
            if 'coty_type' in cd['properties']:
                  cd['properties'].pop('coty_type')
            if 'coty_area_code' in cd['properties']:
                  cd['properties']['cr']=cd['properties']["coty_area_code"]
                  cd['properties'].pop('coty_area_code')
            if 'coty_name' in cd['properties']:
                  cd['properties']['cn']=[cd['properties']["coty_code"][0],cd['properties']["coty_name"][0]]
                  cd['properties'].pop('coty_name')
                  cd['properties'].pop('coty_code')
            if 'ste_code' in cd['properties']:
                  cd['properties']['s']=[cd['properties']["ste_code"][0],cd['properties']["ste_name"][0]]
                  cd['properties'].pop('ste_code')
                  cd['properties'].pop('ste_name')
            if 'geo_point_2d' in cd['properties']:
                  cd['properties']['latlng']=[round(cd['properties']["geo_point_2d"]['lat'],4),round(cd['properties']["geo_point_2d"]['lon'],4)]
                  cd['properties'].pop('geo_point_2d')
            
        res_bytes = json.dumps(countiesData,separators=(',', ':')).encode('utf-8')
        open("USA/"+abbr+"/"+abbr+'_counties.json', "wb").write(res_bytes)
        print("   "+abbr+" counties")
  

      if zipCodeData:
        for zd in zipCodeData['features']:
            solve(zd['geometry']['coordinates'])
            if 'year' in zd['properties']:
                  zd['properties'].pop('year')
            if 'zcta5_name' in zd['properties']:
                  zd['properties'].pop('zcta5_name')
            if 'zcta5_type' in zd['properties']:
                  zd['properties'].pop('zcta5_type')
            if 'zcta5_area_code' in zd['properties']:
                  zd['properties']['cr']=zd['properties']["zcta5_area_code"]
                  zd['properties'].pop('zcta5_area_code')
            if 'zcta5_code' in zd['properties']:
                  zd['properties']['zc']=zd['properties']["zcta5_code"][0]
                  zd['properties'].pop('zcta5_code')
            if 'geo_point_2d' in zd['properties']:
                  zd['properties']['latlng']=[round(zd['properties']["geo_point_2d"]['lat'],4),round(zd['properties']["geo_point_2d"]['lon'],4)]
                  zd['properties'].pop('geo_point_2d')
        res_bytes = json.dumps(zipCodeData).encode('utf-8')
        open("USA/"+abbr+"/"+abbr+'_zipcodes.json', "wb").write(res_bytes)
        print("   "+abbr+" zips")
print("Done")

print("Generating county-level zipcodes per States")
for st in states:
    abbr=st["abbreviation"]
    base_path = '.\\USA\\'+abbr
    Path(base_path, "zipcodes").mkdir()
    countiesData=None
    zipCodeData=None
    with open("USA/"+abbr+'/'+abbr+'_counties.json') as fp:
        countiesData = json.load(fp)
    with open("USA/"+abbr+'/'+abbr+'_zipcodes.json') as fp:
        zipCodeData = json.load(fp)
    if countiesData and zipCodeData:
        for cd in countiesData['features']:
            outputData= {"type": "FeatureCollection",
                    "features": []
                    }
            for zd in zipCodeData['features']:
                if cd['properties']['cn'][0] in zd['properties']['coty_code']:
                        outputData['features'].append(zd)
            res_bytes = json.dumps(outputData,separators=(',', ':')).encode('utf-8')
            open("USA/"+abbr+'/zipcodes/'+cd['properties']['cn'][0]+'_countycode.json', "wb").write(res_bytes)
            print("   "+abbr+" zips for county "+cd['properties']['cn'][1])
print("Done")