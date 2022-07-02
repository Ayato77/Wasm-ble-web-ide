const myDiagram = new go.Diagram("diagramDiv", {
    layout: new go.TreeLayout({ angle: 90, layerSpacing: 35 }),
});

myDiagram.toolManager.panningTool.isEnabled = false;
myDiagram.toolManager.draggingTool.isEnabled = false;


myDiagram.nodeTemplate =
    new go.Node("Horizontal",
        {
            locationSpot: go.Spot.Center,
            background:"#91ADDD"
        })
        .bind("location", "loc")
        .add(new go.TextBlock("default text",
            { margin: 12, stroke: "white", font: "bold 16px sans-serif" })
            .bind("text","name"));

function showMessage(s) {
    document.getElementById("diagramEventMsg").textContent = s;
}

myDiagram.addDiagramListener("ObjectSingleClicked",
    function(e) {
        let part = e.subject.part;
        if (!(part instanceof go.Link)) showMessage("Clicked on " + part.data.key);
    });

myDiagram.model = new go.TreeModel(
    [ // for each object in this Array, the Diagram creates a Node to represent it
        { key: "1", name: "Root"},
        { key: "2", parent:"1",name: "Source1"},
        { key: "3", parent:"1",name: "Source2"}
    ]);
