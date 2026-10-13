# motion-pack/blender: a small Geometry Nodes builder. Node trees are built in code (no .blend assets); every
# animated input is a modifier socket the recipe keys per frame (Phase, Energy, ...), so the geometry is a pure
# function of the frame. MIT (see blender/LICENSE).
import bpy


class G:
    def __init__(self, name):
        self.ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
        self.N, self.L = self.ng.nodes, self.ng.links
        self.inputs = {}
        self.ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
        self.ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
        self.gi = self.N.new("NodeGroupInput")
        self.go = self.N.new("NodeGroupOutput")

    def param(self, name, default=0.0, kind="NodeSocketFloat"):
        s = self.ng.interface.new_socket(name=name, in_out="INPUT", socket_type=kind)
        if hasattr(s, "default_value"):
            s.default_value = default
        self.inputs[name] = s.identifier
        return self.gi.outputs[name]

    def node(self, idname, inputs=None, **props):
        n = self.N.new(idname)
        for k, v in props.items():
            setattr(n, k, v)
        for k, v in (inputs or {}).items():
            self.put(n.inputs[k], v)
        return n

    def put(self, sock, v):
        if v is None:
            return
        if isinstance(v, bpy.types.NodeSocket):
            self.L.new(v, sock)
        else:
            sock.default_value = v

    def link(self, a, b):
        self.L.new(a, b)

    def math(self, op, a, b=None, c=None):
        n = self.N.new("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is not None:
                self.put(n.inputs[i], v)
        return n.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        n = self.N.new("ShaderNodeVectorMath")
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is not None:
                self.put(n.inputs[i], v)
        if scale is not None:
            self.put(n.inputs["Scale"], scale)
        return n.outputs["Value"] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else n.outputs["Vector"]

    def xyz(self, x=0.0, y=0.0, z=0.0):
        n = self.N.new("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.put(n.inputs[i], v)
        return n.outputs[0]

    def sep(self, v):
        n = self.N.new("ShaderNodeSeparateXYZ")
        self.put(n.inputs[0], v)
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def attr(self, name, kind="FLOAT"):
        n = self.N.new("GeometryNodeInputNamedAttribute")
        n.data_type = kind
        n.inputs["Name"].default_value = name
        return n.outputs["Attribute"]

    def store(self, geo, name, val, kind="FLOAT", domain="POINT"):
        n = self.N.new("GeometryNodeStoreNamedAttribute")
        n.data_type = kind
        n.domain = domain
        n.inputs["Name"].default_value = name
        self.put(n.inputs["Geometry"], geo)
        self.put(n.inputs["Value"], val)
        return n.outputs["Geometry"]

    def output(self, geo):
        self.link(geo, self.go.inputs[0])

    def attach(self, ob, name="gn"):
        mod = ob.modifiers.new(name, "NODES")
        mod.node_group = self.ng
        return mod


def input_slot(mod, ident):
    """(owner, property) of a modifier input for the Keyer. Blender 5.x: an RNA struct per input with a keyable
    .value (path modifiers["gn"].properties.inputs.Socket_N.value, probed on 5.2.2); 4.x and earlier: ID properties
    on the modifier ('["Socket_N"]')."""
    props = getattr(mod, "properties", None)
    if props is not None and hasattr(props, "inputs") and hasattr(props.inputs, ident):
        return getattr(props.inputs, ident), "value"
    return mod, '["%s"]' % ident


def points_object(name, col, pts, attrs):
    """A vertex-only mesh: one vertex per point, with float point attributes (seeded per-point parameters)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], [], [])
    for k, vals in attrs.items():
        a = me.attributes.new(k, "FLOAT", "POINT")
        a.data.foreach_set("value", list(vals))
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob
