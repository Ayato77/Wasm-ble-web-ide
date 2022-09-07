const serviceGraphUUID = 0x00EE;
const charGraphUUID_Req_Table = 0xEE01;
//Characteristics
const CharacteristicUUID_Notification = '000000000-0000-0000-0000-000000000000';
const CharacteristicUUID_ReadRead = 0xFF01;
const CharacteristicUUID_Write = '00000000-0000-0000-0000-000000000000';

let keyDevice;
let keyServer;
let keyService;
let keyNotificationCharacteristic;
let keyReadCharacteristic;
let keyWriteCharacteristic;

let esp32Characteristic;
var meshGraphCharacteristic;
let meshMonitorDevice;
let mtu = 20 //Default BLE MTU size is 20 Bytes
let wasmTargetNode = [0,0,0,0,0,0]
let sourceNode = [0,0,0,0,0,0]
let sinkNode = [0,0,0,0,0,0]




/***************
 * BLE
 *****************/

/**
 * web bluetooth api
 * scan ble peripheral devices
 */
function bleScan(){
    //TODO: get service_uuid and characteristic_uuid from html form
    //TODO: show a status message of connection with alert or something
    //TODO: Store requested MTU size!!
    let srvUUID = Number(document.getElementById('srvUUID').value)
    let charUUID = Number(document.getElementById('charUUID').value)
    console.log(srvUUID)
    navigator.bluetooth.requestDevice({
        filters: [{
            //name: 'ESP_GATTS_DEMO',
            //namePrefix:'PREFIX',
            services: [srvUUID]
        }],
        //optionalServices: [serviceGraphUUID]
    })
        .then(device => {
            //startModel('connecting...');
            //connecting
            console.log("device.id    : " + device.id);
            console.log("device.name  : " + device.name);
            console.log("device.uuids : " + device.uuids);
            keyDevice = device;
            keyDevice.addEventListener('gattserverdisconnected', onDisconnected);
            return device.gatt.connect();
        })
        //get service
        .then(server => {
            keyServer = server;
            console.log('Getting service...');
            return server.getPrimaryService(srvUUID);
        })
        //get characteristic
        .then(service => {
            keyService = service;
            console.log('Getting Notification Characteristic...');
            return service.getCharacteristic(charUUID);
        })
        //Characteristic
        .then(characteristic => {
            //Write here Read/Write/Notifications process for characteristic
            esp32Characteristic = characteristic;
            console.log('Got Characteristic');
            console.log(esp32Characteristic.uuid)
            return esp32Characteristic.readValue();
        })
        .then(value => {
            //Get local MTU from the peripheral device.
            let mtu1 = value.getUint8(0);
            let mtu2 = value.getUint8(1);
            mtu = (mtu1<<8 | mtu2);
            console.log('Negotiated MTU size is ' + mtu);
        })
        .catch(error => {
            console.log(error);
        })
};

/**
 * web bluetooth
 * upload wasm binary using writeValue method (ESP_GATTS_WRITE_EVT)
 * @param: Uint8Array, wasm binary compiled by AssemblyScript CLI (See ide.html)
 */
function onUpload(wasmArray){
    console.log('onUpload')
    console.log(wasmArray.length)
    let numberOfPackets = Math.ceil(wasmArray.length/(mtu-3))
    //Assume that the max number of packets is 16^4
    let bufferInit = new ArrayBuffer(9)//
    let byteArray = new Uint8Array(bufferInit)
    byteArray[0] = 0x01;
    byteArray[1] = numberOfPackets>>8;
    byteArray[2] = numberOfPackets % 256;
    byteArray[3] = wasmTargetNode[0];
    byteArray[4] = wasmTargetNode[1];
    byteArray[5] = wasmTargetNode[2];
    byteArray[6] = wasmTargetNode[3];
    byteArray[7] = wasmTargetNode[4];
    byteArray[8] = wasmTargetNode[5];

    let bufferNext = new ArrayBuffer(mtu)
    let byteNextArray = new Uint8Array(bufferNext)


    esp32Characteristic.writeValue(byteArray)
        .then(_ => {
                console.log('numberOfPackets')
                console.log(numberOfPackets)
                let len = 0
                for(let i=0; i<numberOfPackets; i++) {
                    //Fit size of the last packet
                    if(i+1 == numberOfPackets){
                        let bufferLast = new ArrayBuffer((wasmArray.length % mtu) + 3)
                        byteNextArray = new Uint8Array(bufferLast)
                    }
                    byteNextArray[0] = 0x02
                    byteNextArray[1] = i >> 8
                    byteNextArray[2] = i % 256

                    len = byteNextArray.length
                    for (let j = 3; j < len; j++) {
                        byteNextArray[j] = wasmArray[i * (len - 3) + j - 3] //TODO: One can make here more simple
                    }
                    console.log('byteNextArray')
                    console.log(byteNextArray.length)
                    esp32Characteristic.writeValue(byteNextArray).then()
                        .catch(err=> {
                        console.log(err)
                    })
                }
        })
        .catch(error => {
            console.log(error);
    })
}

//TODO: GET function for routing tables.
async function connectMeshMonitorNode(){

    console.log('Getting graph service...');

    try {
        console.log('Requesting Bluetooth Device...');
        meshMonitorDevice = await navigator.bluetooth.requestDevice({
            filters: [{services: [serviceGraphUUID]}]
        });

        console.log('Connecting to GATT Server...');
        const server = await meshMonitorDevice.gatt.connect();

        console.log('Getting Service...');
        const service = await server.getPrimaryService(serviceGraphUUID);

        console.log('Getting Characteristic...');
        meshGraphCharacteristic = await service.getCharacteristic(charGraphUUID_Req_Table);
        console.log('> Characteristic UUID:  ' + meshGraphCharacteristic.uuid);
        console.log('> Broadcast:            ' + meshGraphCharacteristic.properties.broadcast);
        console.log('> Read:                 ' + meshGraphCharacteristic.properties.read);
        console.log('> Write w/o response:   ' +
            meshGraphCharacteristic.properties.writeWithoutResponse);
        console.log('> Write:                ' + meshGraphCharacteristic.properties.write);
        console.log('> Notify:               ' + meshGraphCharacteristic.properties.notify);
        console.log('> Indicate:             ' + meshGraphCharacteristic.properties.indicate);
        console.log('> Signed Write:         ' +
            meshGraphCharacteristic.properties.authenticatedSignedWrites);
        console.log('> Queued Write:         ' + meshGraphCharacteristic.properties.reliableWrite);
        console.log('> Writable Auxiliaries: ' +
            meshGraphCharacteristic.properties.writableAuxiliaries);
        }catch(error) {
        console.log('Connecting to mesh monitor node failed. ' + error);
        return;
    }
}

async function getMeshDataStreamInfo(){
    if(meshGraphCharacteristic == undefined){
        alert("No device connected. Connect to a monitor node first");
        return;
    }
    try{
        const value = await meshGraphCharacteristic.readValue();

        //TODO: add tuple array of links for data stream
        console.log('Response incoming');
        let mtu1 = value.getUint8(0);
        let readTables = 0;
        let i=1;
        let numTarget = 0;
        let hasWasmModule = 0;
        let nodeDataArray = []
        let linkDataArray = []
        let dataSource;
        let dataTarget;
        console.log('Number of node: ' + mtu1);
        console.log('2nd element: ' + value.getUint8(1));
        myDiagram.model.nodeDataArray = [];
        myDiagram.model.linkDataArray = [];

        while(readTables<mtu1){
            dataSource = ""
            hasWasmModule = value.getUint8(i);
            i++;
            numTarget = value.getUint8(i)-1;
            i++;
            console.log('No of address' + numTarget);

            //TODO:Read MAC address of table owner　!!DO NOT USE BIT SHIFT!! convert to string
            for(let k=0;k<6;k++){
                console.log('MAC: ' + value.getUint8(i));
                dataSource = dataSource + value.getUint8(i).toString() + ":" ;
                i++;
            }
            dataSource = dataSource.slice(0,-1);

            console.log("data source:");
            console.log(dataSource);
            myDiagram.startTransaction("add node")
            myDiagram.model.commit(m => {m.addNodeData({key:dataSource, isGroup:true, text:dataSource, wasm: hasWasmModule})},"add node")
            myDiagram.commitTransaction("add node")
            if(hasWasmModule){
                myDiagram.startTransaction("add wasm comp")
                myDiagram.model.commit(m => {m.addNodeData({key:dataSource+"WASM", text:"Wasm"+i.toString(), group:dataSource})},"add wasm comp")
                myDiagram.commitTransaction("add wasm comp")
            }

            for(let j=0;j<numTarget;j++){
                dataTarget = "";
                for(let h=0; h<6; h++){
                    console.log('MAC: ' + value.getUint8(i));
                    dataTarget = dataTarget + value.getUint8(i).toString() + ":";
                    i++;
                }
                dataTarget = dataTarget.slice(0,-1);
                console.log('Target MAC: ' + dataTarget);
                myDiagram.startTransaction("add link");
                myDiagram.model.commit(m => {m.addLinkData({from: dataSource, to:dataTarget})}, "add link");
                myDiagram.commitTransaction("add link");
            }
            readTables++;
        }
        isGraphReady = true;//make graph reactive
        console.log('End reading tables');
    } catch(error) {
        console.log('Update mesh graph failed. ' + error);
        return;
    }
}


function onDisconnected(){
    console.log('> Bluetooth Device disconnected')
};

function getNodes(){
    let obj = [
        { key: 1, text: "Alpha" },
        { key: 2, text: "Beta" },
        { key: 3, text: "Gamma", group: 5 },
        { key: 4, text: "Delta", group: 5 },
        { key: 5, text: "Epsilon", isGroup: true }
    ];
    return obj
}