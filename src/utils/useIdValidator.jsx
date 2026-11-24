import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';

export const useIdValidator = () => {
    const navigate = useNavigate();
    const { shopId } = useParams();

    const isValidIdFormat = (id) => /^[0-9a-f]{24}$/.test(id);

    useEffect(() => {
        console.log(shopId);
        const verifyShop = async () => {
            const isValid = isValidIdFormat(shopId);
            if (!isValid) {
                navigate('*');
            }
        };
        verifyShop();
    }, [shopId, navigate]);
};