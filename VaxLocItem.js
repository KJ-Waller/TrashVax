import React from 'react';
import {ListItem, Text} from '@ui-kitten/components';

const VaxLocItem = (props) => {
    return (
        <ListItem 
            title={`Location #${props['item']['#']}, ${props['item']['distance']} away`}
            description={`Status: ${props['item']['status']}`}
        />
    )
}

export default VaxLocItem