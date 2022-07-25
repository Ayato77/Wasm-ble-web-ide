const portSize = new go.Size(8, 8);

function init() {
    const $ = go.GraphObject.make;

    myDiagram = new go.Diagram("diagramDiv",
        {
            // when a drag-drop occurs in the Diagram's background, make it a top-level node
            mouseDrop: e => finishDrop(e, null),
            //layout:
            "commandHandler.archetypeGroupData": { isGroup: true, text: "Group", horiz: false },
            "undoManager.isEnabled": true
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
                { strokeWidth: 2 }),
            $(go.Shape,
                { toArrow: "Standard", stroke: null })
        );


    myDiagram.model.nodeDataArray = [
        {key:1, isGroup:true, text:"Root"},
        {key:2, isGroup:true, text:"Processor"},
        {key:3, isGroup:true, text:"Reader"},
        {text:"wasm A", group:2, key:-1},
        {text:"wasm B", group:3, key:-2}
    ];

    myDiagram.model.linkDataArray = [
        { from: 1, to: 2 },
        { from: 1, to: 3 }
    ]
}


async function updateGraph(){
    let {nodeDataArray, linkDataArray} = await getMeshDataStreamInfo();
    myDiagram.model.linkDataArray = []
    myDiagram.model.nodeDataArray = []
    myDiagram.model.nodeDataArray = nodeDataArray
    myDiagram.model.linkDataArray = linkDataArray
}


window.addEventListener('DOMContentLoaded', init);
