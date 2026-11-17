// react-scripts 4 bundles with webpack 4, which cannot parse the `import.meta`
// in the ES module build of react-router 7. Import its CommonJS build instead.
export {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router/dist/development/index.js";
