const portSize = new go.Size(8, 8);
let selectedLink;
let selectedWasm;
let isGraphReady = true;

let bufferWasmMovingInit = new ArrayBuffer(13);
let byteWasmMovingArray = new Uint8Array(bufferWasmMovingInit);
let wasmMovingFrom = [0,0,0,0,0,0]
let wasmMovingTo = [0,0,0,0,0,0]

function init() {
    const $ = go.GraphObject.make;

    myDiagram = new go.Diagram("diagramDiv",
        {
            // when a drag-drop occurs in the Diagram's background, make it a top-level node
            mouseDrop: e => finishDrop(e, null),
            //layout:
            "commandHandler.archetypeGroupData": { isGroup: true, text: "Group", horiz: false },
            "undoManager.isEnabled": true,
            "ModelChanged": e => {
                if (e.isTransactionFinished && isGraphReady) {
                    // this records each Transaction as a JSON-format string
                    updateIncremental(myDiagram.model.toIncrementalJson(e));
                }
            },
        });

    myDiagram.layout = new go.LayeredDigraphLayout();

    function defaultColor(horiz) {  // a Binding conversion function
        return horiz ? "rgba(255, 221, 51, 0.55)" : "rgba(51,211,229, 0.5)";
    }

    function defaultFont(horiz) {  // a Binding conversion function
        return horiz ? "bold 20px sans-serif" : "bold 16px sans-serif";
    }

    // this function is used to highlight a Group that the selection may be dropped into
    function highlightGroup(e, grp, show) {
        if (!grp) return;
        e.handled = true;
        if (show) {
            // cannot depend on the grp.diagram.selection in the case of external drag-and-drops;
            // instead depend on the DraggingTool.draggedParts or .copiedParts
            var tool = grp.diagram.toolManager.draggingTool;
            var map = tool.draggedParts || tool.copiedParts;  // this is a Map
            // now we can check to see if the Group will accept membership of the dragged Parts
            if (grp.canAddMembers(map.toKeySet())) {
                grp.isHighlighted = true;
                return;
            }
        }
        grp.isHighlighted = false;
    }

    // Upon a drop onto a Group, we try to add the selection as members of the Group.
    // Upon a drop onto the background, or onto a top-level Node, make selection top-level.
    // If this is OK, we're done; otherwise we cancel the operation to rollback everything.
    function finishDrop(e, grp) {
        var ok = (grp !== null
            ? grp.addMembers(grp.diagram.selection, true)
            : e.diagram.commandHandler.addTopLevelParts(e.diagram.selection, true));
        if (!ok) e.diagram.currentTool.doCancel();
    }

    myDiagram.groupTemplate =
        new go.Group("Auto",
            {
                background: "blue",
                ungroupable: true,
                // highlight when dragging into the Group
                mouseDragEnter: (e, grp, prev) => highlightGroup(e, grp, true),
                mouseDragLeave: (e, grp, next) => highlightGroup(e, grp, false),
                computesBoundsAfterDrag: true,
                // when the selection is dropped into a Group, add the selected Parts into that Group;
                // if it fails, cancel the tool, rolling back any changes
                mouseDrop: finishDrop,
                handlesDragDropForMembers: true,  // don't need to define handlers on member Nodes and Links
                // Groups containing Groups lay out their members horizontally
                portId: "",
                cursor: "pointer",
                fromLinkable: true,
                fromLinkableSelfNode: true,
                fromLinkableDuplicates: true,
                toLinkable: true,
                toLinkableSelfNode: true,
                toLinkableDuplicates: true
            })
            .bind(new go.Binding("background", "isHighlighted", h => h ? "rgba(255,0,0,0.2)" : "transparent").ofObject())
            .add(new go.Shape("Rectangle",
                { fill: null, stroke: defaultColor(false), fill: defaultColor(false), strokeWidth: 2 })
                .bind("stroke", "horiz", defaultColor)
                .bind("fill", "horiz", defaultColor))
            .add(
                new go.Panel("Vertical",
                    //TODO: Make a port, remove linkable setting in groupTemplate
                    {
                        row: 1, column: 0,
                        itemTemplate:
                            new go.Panel(
                                {
                                    _side: "left",  // internal property to make it easier to tell which side it's on
                                    fromSpot: go.Spot.Left, toSpot: go.Spot.Left,
                                    fromLinkable: true, toLinkable: true, cursor: "pointer",
                                })
                                .bind("portId", "portId")
                                .add(new go.Shape("Rectangle",
                                    {
                                        stroke: null, strokeWidth: 0,
                                        desiredSize: portSize,
                                        margin: new go.Margin(1, 0)
                                    })
                                    .bind("fill", "portColor")
                                )  // end itemTemplate
                    }
                    )
                    .bind("itemArray", "leftArray")
                    // title above Placeholder
                    .add(new go.Panel("Horizontal",  // button next to TextBlock
                        { stretch: go.GraphObject.Horizontal, background: defaultColor(false) })
                        .bind("background", "horiz", defaultColor)
                        //.add(go.GraphObject.make("SubGraphExpanderButton", { alignment: go.Spot.Right, margin: 5 }))
                        .add(new go.TextBlock(
                            {
                                alignment: go.Spot.Left,
                                editable: true,
                                margin: 5,
                                font: defaultFont(false),
                                opacity: 0.95,  // allow some color to show through
                                stroke: "#404040"
                            })
                            .bind("font", "horiz", defaultFont)
                            .bind("text", "text", null, null)) // `null` as the fourth argument makes this a two-way binding
                    )  // end Horizontal Panel
                    .add(new go.Placeholder({ padding: 5, alignment: go.Spot.TopLeft }))
            )  // end Vertical Panel


    myDiagram.nodeTemplate =
        new go.Node("Auto",
            { // dropping on a Node is the same as dropping on its containing Group, even if it's top-level
                mouseDrop: (e, node) => finishDrop(e, node.containingGroup)
            })
            .add(new go.Shape("RoundedRectangle", {
                fill: "rgb(239,252,60)",
                stroke: "white",
                strokeWidth: 0.5
            }))
            .add(new go.TextBlock(
                {
                    margin: 7,
                    editable: true,
                    font: "bold 13px sans-serif",
                    opacity: 0.90
                })
                .bind("text", "text", null, null));  // `null` as the fourth argument makes this a two-way binding

    myDiagram.linkTemplate =
        $(go.Link,
            {
                // allow the user to reconnnect existing links:
                relinkableFrom: true, relinkableTo: true,
                // draw the link path shorter than normal,
                // so that it does not interfere with the appearance of the arrowhead
                toShortLength: 2
            },
            $(go.Shape,
                { strokeWidth: 2 },
                new go.Binding("stroke", "color")),
            $(go.Shape,
                { toArrow: "Standard", stroke: null },
                new go.Binding("fill", "color"))
        );

    myDiagram.addDiagramListener("ObjectSingleClicked",
        function(e) {
            var part = e.subject.part;
            if (part instanceof go.Group){
                setSelectedNodeMAC(part.data.key);
            }
            else if(part instanceof go.Link){
                selectedLink = myDiagram.model.findLinkDataForKey(part.data.key)
                console.log(JSON.stringify(selectedLink))
            }
        });

    myDiagram.addModelChangedListener(function (evt){
        if (evt.isTransactionFinished){
            var txn = evt.object;  // a Transaction
        // iterate over all of the actual ChangedEvents of the Transaction
            txn.changes.each(function(e) {
                if (e.change === go.ChangedEvent.Property) {
                    if (e.modelChange === "nodeGroupKey") {
                        console.log(evt.propertyName + " changed group key: " +
                            e.object + " from: " + e.oldValue + " to: " + e.newValue);

                        if(meshGraphCharacteristic == undefined){
                            console.log("No BLE device connected!")
                            //TODO: call undo
                            return;
                        }

                        if(e.oldValue !== undefined && e.newValue !== undefined){
                            if(!myDiagram.model.findNodeDataForKey(e.newValue).wasm){
                                alert("This node has no wasm environment!!");
                                //TODO: call undo
                                return;
                            }
                            byteWasmMovingArray[0] = BLE_WASM_MOVING;
                            wasmMovingFrom = e.oldValue.split(':').map(Number);
                            wasmMovingTo = e.newValue.split(':').map(Number);
                            for(let i=0; i<6; i++){
                                byteWasmMovingArray[i+1] = wasmMovingFrom[i];
                            }

                            for(let j=0; j<6; j++){
                                byteWasmMovingArray[j+7] = wasmMovingTo[j];
                            }

                            meshGraphCharacteristic.writeValue(byteWasmMovingArray)
                                .then(_=>{console.log("MSG transmitted: wasm moving")})
                                .catch(err => {
                                    console.log(err)
                                });
                        }
                        else if(e.oldValue !== undefined && e.newValue === undefined){
                            byteWasmMovingArray[0] = BLE_WASM_OFF_MSG
                            meshGraphCharacteristic.writeValue(byteWasmMovingArray)
                                .then(_=>{console.log("MSG transmitted: wasm moving")})
                                .catch(err => {
                                    console.log(err)
                                });
                        }
                    }
                }
            });
        }
    });

    myDiagram.model = $(go.GraphLinksModel,
        {
            nodeKeyProperty: 'key',
            linkKeyProperty: 'key',
            nodeGroupKeyProperty: 'group',
            nodeDataArray: [
                {key:"1", isGroup:true, text:"Root", wasm: 0},
                {key:"2", isGroup:true, text:"Processor", wasm: 1},
                {key:"3", isGroup:true, text:"Reader", wasm: 0},
                {text:"wasm A", group:"2", key:"-1"},
                {text:"wasm B", group:"3", key:"-2"}
            ],
            linkDataArray: [
                { key:"1", from: "1", to: "2" , color: 'red'},
                { key:"2", from: "1", to: "3" , color: 'red'},
                { key:"3", from: "3", to: "2" }
            ]
        })
}


async function updateGraph(){
    isGraphReady = false;
    await getMeshDataStreamInfo();
}

function setSelectedNodeMAC(macAddress){
    wasmTargetNode = macAddress.split(':').map(Number);
    console.log("MAC of current selected node: ");
    console.log(wasmTargetNode);
}


function updateIncremental(str) {
    console.log(str);
    let obj = JSON.parse(str);
    let src = '';
    let sink = '';
    let bufferInit = new ArrayBuffer(13)
    let byteArray = new Uint8Array(bufferInit)

    if(meshGraphCharacteristic == undefined){
        console.log("No BLE device connected!")
        return;
    }
    //TODO: Transmit from and to MAC address via BLE to update the real network links between MCUs
    if(obj.modifiedLinkData != undefined){
        sourceNode = obj.modifiedLinkData[0].from.split(':').map(Number);
        sinkNode = obj.modifiedLinkData[0].to.split(':').map(Number);

        console.log('modifiedLinkData: ' + obj.modifiedLinkData[0].from);
        console.log('modifiedLinkData: ' + obj.modifiedLinkData[0].to);

        byteArray[0] = BLE_ADD_DATA_DEST;
        for(let i=0; i<6; i++){
            byteArray[i+1] = sourceNode[i];
        }

        for(let j=0; j<6; j++){
            byteArray[j+7] = sinkNode[j];
        }

        meshGraphCharacteristic.writeValue(byteArray)
            .then(_=>{console.log("MSG transmitted: modify link")})
            .catch(err => {
                console.log(err)
            });
    }
    else if(obj.removedLinkKeys!=undefined){
        //Assume that only one link will be deleted at once
        if(obj.removedLinkKeys[0] == selectedLink.key){
            sourceNode = selectedLink.from.split(':').map(Number);
            sinkNode = selectedLink.to.split(':').map(Number);
            byteArray[0] = BLE_REMOVE_DATA_DEST;
            for(let i=0; i<6; i++){
                byteArray[i+1] = sourceNode[i];
            }

            for(let j=0; j<6; j++){
                byteArray[j+7] = sinkNode[j];
            }

            meshGraphCharacteristic.writeValue(byteArray)
                .then(_=>{console.log("MSG transmitted: remove link")})
                .catch(err => {
                    console.log(err)
                });
        }

    }

}


window.addEventListener('DOMContentLoaded', init);
