# curl examples  (base: http://localhost:3000, add `-H "x-api-key: $API_KEY"` if API_KEY is set)

```bash
B=http://localhost:3000/api/v1
ORDER='{"courier_partner":"mock","order_id":"ORD-1001",
 "pickup_address":{"name":"Warehouse","phone":"9876543210","line1":"1 Industrial Rd","city":"Bengaluru","state":"KA","pincode":"560001"},
 "delivery_address":{"name":"Asha","phone":"9123456780","line1":"22 MG Road","city":"Pune","state":"MH","pincode":"411001"},
 "items":[{"sku":"SKU-1","name":"Shoes","quantity":1,"unit_price":1999}],
 "shipment":{"weight_kg":1.2,"length_cm":20,"breadth_cm":15,"height_cm":10},
 "payment":{"mode":"PREPAID"}}'

# supported couriers
curl -s $B/couriers

# create (switch "mock" -> "urbanebolt" to route to UrbaneBolt; the payload is identical)
curl -s -X POST $B/orders -H 'Content-Type: application/json' -d "$ORDER"

# same order_id again -> 200, idempotent_replay:true, same AWB
curl -s -X POST $B/orders -H 'Content-Type: application/json' -d "$ORDER"

# get / track / cancel
curl -s $B/orders/ORD-1001
curl -s $B/orders/ORD-1001/track
curl -s -X POST $B/orders/ORD-1001/cancel -H 'Content-Type: application/json' -d '{"courier_partner":"mock","reason":"customer request"}'

# bulk (mixed couriers, one failing, one unknown courier) -> 202 + batch_id
curl -s -X POST $B/orders/bulk -H 'Content-Type: application/json' -d "{\"orders\":[
  ${ORDER/ORD-1001/BULK-1},
  ${ORDER/ORD-1001/BULK-FAIL-2},
  ${ORDER/ORD-1001/BULK-3}
]}"
curl -s $B/orders/bulk/<batch_id>

# operators (settings stored in MySQL)
curl -s $B/operators
curl -s -X PATCH $B/operators/urbanebolt -H 'Content-Type: application/json' -d '{"settings":{"customerCode":"UEBCUS0008"},"runtime":{"timeoutMs":15000}}'
curl -s -X PATCH $B/operators/mock -H 'Content-Type: application/json' -d '{"enabled":false}'

# reconciliation worklist
curl -s "$B/orders?status=FAILED&needs_reconciliation=true"

# error shapes
curl -s -X POST $B/orders -H 'Content-Type: application/json' -d '{"courier_partner":"mock"}'   # 400 VALIDATION_ERROR
curl -s -X POST $B/orders -H 'Content-Type: application/json' -d "${ORDER/mock/dhl}"            # 400 UNKNOWN_COURIER (+ supported list)
```
