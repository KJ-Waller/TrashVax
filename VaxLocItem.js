import React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {ListItem, Text} from '@ui-kitten/components';

const VaxLocItem = (props) => {

    const locName = props['item']['locName'];
    const locPlace = props['item']['locPlace'];
    const statusDesc = props['item']['status']
    let listTitle

    if (locPlace == null) {
        listTitle = `${locName}`
    } else {
        listTitle = `${locName}, ${locPlace}`
    }

    let vaccinesAvailable = statusDesc.includes('heeft') && statusDesc.includes('beschikbaar') && !statusDesc.includes('geen')

    return (
        <ListItem 
            title={listTitle}
            description={`Status: ${statusDesc}`}
            onPress={() => {
                if (vaccinesAvailable) {
                    Clipboard.setString(locPlace)
                }
            }}
        />
    )
}

export default VaxLocItem