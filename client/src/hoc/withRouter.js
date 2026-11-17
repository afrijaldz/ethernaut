import { useLocation, useNavigate, useParams } from "../router";

export const withRouter = (Component) => {
    const Wrapper = (props) =>{
        const navigate = useNavigate();
        const params = useParams();
        const location = useLocation();

        return (
            <Component
                params={params}
                navigate={navigate}
                location={location}
                {...props}
            />
        )
    } 
    return Wrapper;
}