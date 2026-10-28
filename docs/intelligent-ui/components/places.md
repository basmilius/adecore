# Places

Show places on a map the host draws. Give a place as `lat` and `lon` in decimal degrees, or as an address the host looks up. A block cannot name tiles, a map URL, a style or a vendor.

<Demo src="intelligent-ui/places" />

```ui
$picked = ""
<Map value={$picked}>
<Place lat={52.0907} lon={5.1214} value="dom" detail="Climb the tower">Domtoren</Place>
<Place address="Oudegracht 245, Utrecht" value="gracht">Oudegracht</Place>
<Place lat={52.0894} lon={5.1103} value="station">Station</Place>
</Map>
<Choices><Choice context={"Plan the walk around " + $picked}>Plan the walk</Choice></Choices>
```

## Map

One to 50 places, with a numbered list under the map; more written are refused. After `Each` or `Show`, a `Map` that draws none fails as a whole, and one that draws more than 50 shows the first 50 with `too_many_children` and a count of the rest (`UiViewNode.omitted`). The list is the accessible form of the map and holds every place, also those without a point.

| Prop    | Type   | Required | Notes                                                |
| ------- | ------ | -------- | ---------------------------------------------------- |
| `value` | scalar | No       | Bindable; the `value` of the place a person picked   |

A bound `Map` is an input: each row whose `Place` has a `value` is a button that sets the binding. A Choice carries the value only when a place of that map offers it, or when it is still the default.

## Place

One place. It stands only inside `Map`, and its children are the name.

| Prop      | Type   | Required | Notes                                                                 |
| --------- | ------ | -------- | --------------------------------------------------------------------- |
| `lat`     | number | With `lon` | From -90 to 90                                                      |
| `lon`     | number | With `lat` | From -180 to 180                                                    |
| `address` | string | Or `lat` and `lon` | At most 512 characters; looked up by the host |
| `detail`  | string | No       | A line under the name                                                 |
| `value`   | scalar | No       | What picking the place sets on the bound `Map`                        |

A `Place` with only one of `lat` and `lon`, or with neither coordinates nor an address, fails alone and draws as its text. With both, the host's lookup wins; `lat` and `lon` stand until it answers or when it finds nothing.

## Looking up an address

A renderer does not look anything up. `UiRenderContext.place(nodeId, address)` returns the host's point for that address: `undefined` until the block is frozen, and `null` for an address without a point. A reading applies only to the address it was made for. The list says `Looking up` for `undefined` and `Not on the map` for `null`, without a marker. [Live queries](/intelligent-ui/host/queries#places) covers how the host freezes the points.

## What the host draws

The renderer draws the host's tiles when it has them, otherwise a world outline (Natural Earth 110m land, public domain) that zooms no closer than about a country. The numbered list always stands under it. The picture is not saved with the block. A third button beside the zoom buttons fits every place in view, and overlapping markers spread apart.

## Fallback

A `Map` falls back to a numbered list, one line per drawn place: `1. Domtoren (52.0907, 5.1214): Climb the tower`. A failed place stays unnumbered, as its text.
