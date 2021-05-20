import React from 'react';
import {Clipboard, ToastAndroid} from 'react-native';
import {Icon, ListItem, Text} from '@ui-kitten/components';

const VaxLocItem = (props) => {

    const locName = props['item']['locName'];
    const locPlace = props['item']['locPlace'];
    const statusDescNL = props['item']['status'].toLowerCase()
    let listTitle

    if (locPlace == null) {
        listTitle = `${locName}`
    } else {
        listTitle = `${locName}, ${locPlace}`
    }

    let vaccinesAvailable = statusDescNL.includes('heeft') && statusDescNL.includes('beschikbaar') && !statusDescNL.includes('geen')
    let statusDescEN
    if (vaccinesAvailable) {
        statusDescEN = 'Vaccines Available!'
    } else {
        statusDescEN = 'No Vaccines Available'
    }

    const showToast = () => {
        ToastAndroid.show('Address copied to clipboard', ToastAndroid.SHORT)
    }

    const CopyIcon = (props) => (
        <Icon style={{height: 35, width: 35}} name='copy-outline' {...props}/>
    )

    if (vaccinesAvailable) {
        return (
            <ListItem 
                title={listTitle}
                description={`Status: ${statusDescEN}`}
                onPress={() => {
                    Clipboard.setString(locPlace)
                    showToast()
                }}
                accessoryRight={CopyIcon}
            />
        )
    } else {
        return (
            <ListItem 
                title={listTitle}
                description={`Status: ${statusDescEN}`}
            />
        )
    }
}

export default VaxLocItem