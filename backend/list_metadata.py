"""Legacy arrays advertise their boundary and point to the complete paged API."""
async def legacy_list_metadata(response, db, collection, store_id, kind, limit):
    if response is None:
        return
    total=await db[collection].count_documents({'store_id':store_id})
    response.headers['X-Geraina-Total']=str(total)
    response.headers['X-Geraina-List-Limit']=str(limit)
    response.headers['X-Geraina-Complete']='true' if total<=limit else 'false'
    response.headers['Link']=f'</api/records/{kind}?limit=500>; rel="collection"'
