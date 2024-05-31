A standalone library to emulate SVGs API method [`isPointInFill()`](https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/isPointInFill) or Canvas Drawing API method [`isPointInPath()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath?retiredLocale=de). 
This helper is based on the ray-cast method and works indepentantly from browser APIs - so it runs also in headless environments.


## Install (Browser)
```
<script src="https://cdn.jsdelivr.net/gh/herrstrietzel/point-in-fill-raycast@main/js/point-in-fill-raycast.js"></script>
```

## Usage

1. parse and convert arbitrary pathdata to a polygon data array via `pathDataToCompoundPoly(polygonData, precision)` method. This conversion also respects **compound paths** such as the letter "O" (containing a "cut-out" inner bowl).  
Precision parameter adds more vertices when approximating Béziers or Arc commands at the cost of a slightly slower performance. 
2. Test points in fill via `isPointInCompoundPolygon(polygonData, pt)`

```
let d = path.getAttribute("d");
let polygonData = pathDataToCompoundPoly(pathData, precision);

let pointInPoly = isPointInCompoundPolygon(polygonData, pt);
```

3. Alternatively you can use `isPointInPathData(d, pt, precision = 10)` to directly pass a pathData string.
   This approach is suited for single point checks. For recurring point in fill tests prefer the aforementioned method as it improves performance significantly due to the reusable polygon data


## Demo
* [Pointilize](https://codepen.io/herrstrietzel/pen/mdYWrXB)
* [ray-cast vs canvas `isPointInPath()`](https://codepen.io/herrstrietzel/pen/ExzWgEj)

