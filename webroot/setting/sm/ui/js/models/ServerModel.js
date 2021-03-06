/*
 * Copyright (c) 2014 Juniper Networks, Inc. All rights reserved.
 */

define([
    "underscore",
    "backbone",
    "knockout",
    "contrail-model",
    "sm-basedir/setting/sm/ui/js/models/InterfacesModel",
    "sm-basedir/setting/sm/ui/js/models/SwitchModel",
    "sm-basedir/setting/sm/ui/js/models/RoutesModel",
    "sm-constants",
    "sm-utils",
    "sm-model-config"
], function (_, Backbone, Knockout, ContrailModel, InterfaceModel, SwitchModel, RoutesModel, smwc, smwu, smwmc) {
    var ServerModel = ContrailModel.extend({

        defaultConfig: smwmc.getServerModel(),

        formatModelConfig: function (modelConfig) {

            /*
                Populating contrail and network objects if set to null
             */
            if(modelConfig.contrail == null || modelConfig.contrail == "") {
                modelConfig.contrail = {
                    "control_data_interface": null
                };
            }

            if(modelConfig.network == null || modelConfig.network == "") {
                modelConfig.network = {
                    "management_interface": null,
                    "interfaces": []
                };
            }

            if(modelConfig.top_of_rack == null || modelConfig.top_of_rack == "") {
                modelConfig.top_of_rack = {
                    "switches": []
                };
            }

            if(modelConfig.network == null || modelConfig.network == "") {
                modelConfig.network = {
                    "routes": []
                };
            }

            /*
                Populating InterfaceModel from network.interfaces
             */
            var interfaces = (modelConfig.network != null) ? (modelConfig.network.interfaces) : [],
                interfaceModels = [], interfaceModel,
                interfaceCollectionModel;

            for(var i = 0; i < interfaces.length; i++) {
                interfaceModel = new InterfaceModel(interfaces[i]);
                interfaceModels.push(interfaceModel);
            }

            interfaceCollectionModel = new Backbone.Collection(interfaceModels);
            modelConfig.interfaces = interfaceCollectionModel;
            if(modelConfig.network != null) {
                delete modelConfig.network.interfaces;
            }

            /*
             Populating RoutesModel from network.routes
             */
            var routes = (modelConfig.network != null) ? (modelConfig.network.routes) : [],
                routeModels = [], routeModel,
                routeCollectionModel;

            for(var i = 0; i < routes.length; i++) {
                routesModel = new RoutesModel(routes[i]);
                routeModels.push(routesModel);
            }

            routeCollectionModel = new Backbone.Collection(routeModels);
            modelConfig.routes = routeCollectionModel;
            if(modelConfig.network != null) {
                delete modelConfig.network.routes;
            }

            /*
                Populating SwitchModel from top_of_rack.switches
             */
            var switches = (modelConfig.top_of_rack != null) ? (modelConfig.top_of_rack.switches) : [],
                switchModels = [], switchModel,
                switchCollectionModel;

            for(var j = 0; j < switches.length; j++) {
                // manually need to replace 'id' in switches by 'switch_id'
                // as backbone collection does not allow 'id' field in a collection
                if(contrail.checkIfExist(switches[j].id)){
                    switches[j].switch_id = switches[j].id;
                    delete switches[j].id;
                }
                switchModel = new SwitchModel(switches[j]);
                switchModels.push(switchModel);
            }

            switchCollectionModel = new Backbone.Collection(switchModels);
            modelConfig.switches = switchCollectionModel;
            if(modelConfig.top_of_rack != null) {
                delete modelConfig.top_of_rack.switches;
            }

            return modelConfig;
        },

        getServerInterfaces: function (serverAttributes) {
            var interfaceCollection = serverAttributes.interfaces.toJSON(),
                interfaceArray = [], interfaceAttributes;

            for(var i = 0; i < interfaceCollection.length; i++) {
                interfaceAttributes = interfaceCollection[i].model().attributes;
                delete interfaceAttributes.errors;
                delete interfaceAttributes.locks;
                interfaceArray.push(interfaceCollection[i].model().attributes);
            }
            return interfaceArray;
        },

        getRoutes: function (serverAttributes) {
            var routeCollection = serverAttributes.routes.toJSON(),
                routeArray = [], routeAttributes;

            for(var i = 0; i < routeCollection.length; i++) {
                routeAttributes = routeCollection[i].model().attributes;
                delete routeAttributes.errors;
                delete routeAttributes.locks;
                routeArray.push(routeCollection[i].model().attributes);
            }
            return routeArray;
        },

        getSwitches: function (serverAttributes) {
            var switchCollection = serverAttributes.switches.toJSON(),
                switchArray = [], switchAttributes;

            for(var i = 0; i < switchCollection.length; i++) {
                switchAttributes = switchCollection[i].model().attributes;
                delete switchAttributes.errors;
                delete switchAttributes.locks;
                switchArray.push(switchCollection[i].model().attributes);
            }
            return switchArray;
        },

        getServerStorageDisks: function (serverAttributes) {
            var diskCollection = serverAttributes.disks.toJSON(),
                diskArray = [], diskAttributes;

            for(var i = 0; i < diskCollection.length; i++) {
                diskAttributes = diskCollection[i].model().attributes;
                delete diskAttributes.errors;
                delete diskAttributes.locks;
                diskArray.push(diskAttributes.disk);
            }
            return diskArray;
        },

        configure: function (checkedRows, callbackObj) {
            var validations = [
                { key: null, type: cowc.OBJECT_TYPE_MODEL, getValidation: smwc.KEY_CONFIGURE_VALIDATION },
                { key: "interfaces", type: cowc.OBJECT_TYPE_COLLECTION, getValidation: function (interfaceModel) { return (interfaceModel.attributes.type() + "Validation"); } },
                { key: "switches", type: cowc.OBJECT_TYPE_COLLECTION, getValidation: "topOfRackValidation" }
            ];

            if (this.isDeepValid(validations)) {
                var ajaxConfig = {};
                var putData = {}, serverAttrsEdited = [], serversEdited = [],
                    serverAttrs = this.model().attributes,
                    serverSchema = smwmc.getServerSchema(),
                    originalAttrs = this.model()._originalAttributes,
                    locks = this.model().attributes.locks.attributes,
                    interfaces, switches;

                interfaces = this.getServerInterfaces(serverAttrs);
                switches = this.getSwitches(serverAttrs);
                routes = this.getRoutes(serverAttrs);

                /* Special handling to reaplace switch_id by id and add type as 'ovs' - START*/
                for (var i = 0; i < switches.length; i++) {
                    if (contrail.checkIfExist(switches[i].switch_id)) {
                        switches[i].id = switches[i].switch_id;
                        switches[i].type = smwc.TYPE_OVS;
                        delete switches[i].switch_id;
                    }
                }
                /* Special handling to reaplace switch_id by id and add type as 'ovs'- END*/

                // need to delete these as they are collections
                delete serverAttrs.interfaces;
                delete serverAttrs.switches;
                delete serverAttrs.routes;

                serverAttrsEdited = cowu.getEditConfigObj(serverAttrs, locks, serverSchema, "");

                serverAttrsEdited.network.interfaces = interfaces;
                delete serverAttrsEdited.interfaces;

                serverAttrsEdited.network.routes = routes;
                delete serverAttrsEdited.routes;

                serverAttrsEdited.top_of_rack = {switches : switches};
                delete serverAttrsEdited.switches;

                var storage_osd_disks = serverAttrsEdited.parameters.provision.contrail_4.storage.storage_osd_disks,
                    storageOsdDisksArr = [],
                    storage_osd_ssd_disks = serverAttrsEdited.parameters.provision.contrail_4.storage.storage_osd_ssd_disks,
                    storageOsdSsdDisksArr = [];

                if (!Array.isArray(storage_osd_disks)) {
                    storageOsdDisksArr = storage_osd_disks.split(",");
                    for (var i=0; i< storageOsdDisksArr.length; i++) {
                        storageOsdDisksArr[i] = storageOsdDisksArr[i].trim();
                    }
                    serverAttrsEdited.parameters.provision.contrail_4.storage.storage_osd_disks = storageOsdDisksArr;
                }
                if (!Array.isArray(storage_osd_ssd_disks)) {
                    storageOsdSsdDisksArr = storage_osd_ssd_disks.split(",");
                    for (var i=0; i< storageOsdSsdDisksArr.length; i++) {
                        storageOsdSsdDisksArr[i] = storageOsdSsdDisksArr[i].trim();
                    }
                    serverAttrsEdited.parameters.provision.contrail_4.storage.storage_osd_ssd_disks = storageOsdSsdDisksArr;
                }

                putData[smwc.SERVER_PREFIX_ID] = serversEdited;
                if(originalAttrs.cluster_id != serverAttrsEdited.cluster_id) {
                    smwu.removeRolesFromServers(putData);
                }

                 ajaxConfig.type = "PUT";
                 ajaxConfig.data = JSON.stringify(putData);
                 ajaxConfig.url = smwu.getObjectUrl(smwc.SERVER_PREFIX_ID);

                contrail.ajaxHandler(ajaxConfig, function () {
                    if (contrail.checkIfFunction(callbackObj.init)) {
                        callbackObj.init();
                    }
                }, function () {
                    if (contrail.checkIfFunction(callbackObj.success)) {
                        callbackObj.success();
                    }
                }, function (error) {
                    console.log(error);
                    if (contrail.checkIfFunction(callbackObj.error)) {
                        callbackObj.error(error);
                    }
                });
            } else {
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(this.getFormErrorText(smwc.SERVER_PREFIX_ID));
                }
            }
        },
        configureServers: function (checkedRows, callbackObj) {
            var ajaxConfig = {};
            var putData = {}, serverAttrsEdited = {}, serversEdited = [],
                serverAttrs = this.model().attributes,
                serverSchema = smwmc.getServerSchema(),
                locks = this.model().attributes.locks.attributes;

            serverAttrsEdited = cowu.getEditConfigObj(serverAttrs, locks, serverSchema, "");
            $.each(checkedRows, function (checkedRowsKey, checkedRowsValue) {
                serversEdited.push($.extend(true, {}, serverAttrsEdited, {id: checkedRowsValue.id}));
            });

            putData[smwc.SERVER_PREFIX_ID] = serversEdited;
            smwu.removeRolesFromServers(putData);

            ajaxConfig.type = "PUT";
            ajaxConfig.data = JSON.stringify(putData);
            ajaxConfig.url = smwu.getObjectUrl(smwc.SERVER_PREFIX_ID);

            contrail.ajaxHandler(ajaxConfig, function () {
                if (contrail.checkIfFunction(callbackObj.init)) {
                    callbackObj.init();
                }
            }, function () {
                if (contrail.checkIfFunction(callbackObj.success)) {
                    callbackObj.success();
                }
            }, function (error) {
                console.log(error);
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(error);
                }
            });
        },
        createServer: function (callbackObj, ajaxMethod) {
            var validations = [
                { key: null, type: cowc.OBJECT_TYPE_MODEL, getValidation: smwc.KEY_CONFIGURE_VALIDATION },
                { key: "interfaces", type: cowc.OBJECT_TYPE_COLLECTION, getValidation: function (interfaceModel) { return (interfaceModel.attributes.type() + "Validation"); } },
                { key: "switches", type: cowc.OBJECT_TYPE_COLLECTION, getValidation: "topOfRackValidation"}
            ];

            if (this.isDeepValid(validations)) {
                var ajaxConfig = {};
                var putData = {}, serverAttrsEdited = [], serversCreated = [],
                    serverAttrs = this.model().attributes,
                    serverSchema = smwmc.getServerSchema(),
                    locks = this.model().attributes.locks.attributes,
                    interfaces, switches;

                interfaces = this.getServerInterfaces(serverAttrs);
                switches = this.getSwitches(serverAttrs);

                /* Special handling to reaplace switch_id by id and add type as 'ovs' - START*/
                for (var i = 0; i < switches.length; i++) {
                    if (contrail.checkIfExist(switches[i].switch_id)) {
                        switches[i].id = switches[i].switch_id;
                        switches[i].type = smwc.TYPE_OVS;
                        delete switches[i].switch_id;
                    }
                }
                /* Special handling to reaplace switch_id by id and add type as 'ovs'- END*/

                // need to delete these as they are collections
                delete serverAttrs.interfaces;
                delete serverAttrs.switches;

                serverAttrsEdited = cowu.getEditConfigObj(serverAttrs, locks, serverSchema, "");

                serverAttrsEdited.network.interfaces = interfaces;
                delete serverAttrsEdited.interfaces;

                serverAttrsEdited.top_of_rack = {switches : switches};
                delete serverAttrsEdited.switches;

                serversCreated.push(serverAttrsEdited);

                putData[smwc.SERVER_PREFIX_ID] = serversCreated;

                ajaxConfig.type = contrail.checkIfExist(ajaxMethod) ? ajaxMethod : "PUT";
                ajaxConfig.data = JSON.stringify(putData);
                ajaxConfig.url = smwu.getObjectUrl(smwc.SERVER_PREFIX_ID);

                contrail.ajaxHandler(ajaxConfig, function () {
                    if (contrail.checkIfFunction(callbackObj.init)) {
                        callbackObj.init();
                    }
                }, function () {
                    if (contrail.checkIfFunction(callbackObj.success)) {
                        callbackObj.success();
                    }
                }, function (error) {
                    console.log(error);
                    if (contrail.checkIfFunction(callbackObj.error)) {
                        callbackObj.error(error);
                    }
                });
            } else {
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(this.getFormErrorText(smwc.SERVER_PREFIX_ID));
                }
            }
        },
        editRoles: function (checkedRows, callbackObj) {
            var ajaxConfig = {};
            if (this.model().isValid(true, smwc.KEY_CONFIGURE_VALIDATION)) {
                var serverAttrs = this.model().attributes,
                    putData = {}, servers = [],
                    roles = serverAttrs.roles.split(",");

                for (var i = 0; i < checkedRows.length; i++) {
                    servers.push({"id": checkedRows[i].id, "roles": roles});
                }
                putData[smwc.SERVER_PREFIX_ID] = servers;

                ajaxConfig.type = "PUT";
                ajaxConfig.data = JSON.stringify(putData);
                ajaxConfig.url = smwu.getObjectUrl(smwc.SERVER_PREFIX_ID);

                contrail.ajaxHandler(ajaxConfig, function () {
                    if (contrail.checkIfFunction(callbackObj.init)) {
                        callbackObj.init();
                    }
                }, function () {
                    if (contrail.checkIfFunction(callbackObj.success)) {
                        callbackObj.success();
                    }
                }, function (error) {
                    console.log(error);
                    if (contrail.checkIfFunction(callbackObj.error)) {
                        callbackObj.error(error);
                    }
                });
            } else {
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(this.getFormErrorText(smwc.SERVER_PREFIX_ID));
                }
            }
        },
        editTags: function (checkedRows, callbackObj) {
            var ajaxConfig = {};
            if (this.model().isValid(true, smwc.KEY_EDIT_TAGS_VALIDATION)) {
                var putData = {}, serverAttrsEdited = {}, serversEdited = [],
                    serverAttrs = this.model().attributes,
                    serverSchema = smwmc.getServerSchema(),
                    locks = this.model().attributes.locks.attributes,
                    that = this;

                contrail.ajaxHandler({
                    type: "GET",
                    url: smwc.URL_TAG_NAMES
                }, function () {
                }, function (response) {
                    $.each(response, function (tagKey, tagValue) {
                        if (!contrail.checkIfExist(serverAttrs.tag[tagValue])) {
                            serverAttrs.tag[tagValue] = null;
                        }
                    });

                    // need to delete these as they are collections
                    delete serverAttrs.interfaces;
                    delete serverAttrs.switches;

                    serverAttrsEdited = cowu.getEditConfigObj(serverAttrs, locks, serverSchema, "");

                    $.each(checkedRows, function (checkedRowsKey, checkedRowsValue) {
                        serversEdited.push({"id": checkedRowsValue.id, "tag": serverAttrsEdited.tag});
                    });
                    putData[smwc.SERVER_PREFIX_ID] = serversEdited;

                    ajaxConfig.type = "PUT";
                    ajaxConfig.data = JSON.stringify(putData);
                    ajaxConfig.url = smwu.getObjectUrl(smwc.SERVER_PREFIX_ID);

                    contrail.ajaxHandler(ajaxConfig, function () {
                        if (contrail.checkIfFunction(callbackObj.init)) {
                            callbackObj.init();
                        }
                    }, function () {
                        if (contrail.checkIfFunction(callbackObj.success)) {
                            callbackObj.success();
                        }
                    }, function (error) {
                        console.log(error);
                        if (contrail.checkIfFunction(callbackObj.error)) {
                            callbackObj.error(error);
                        }
                    });
                }, function (error) {
                    console.log(error);
                    that.showErrorAttr(smwc.SERVER_PREFIX_ID + "_form", error.responseText);
                });
            } else {
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(this.getFormErrorText(smwc.SERVER_PREFIX_ID));
                }
            }
        },
        reimage: function (rows, callbackObj) {
            var ajaxConfig = {}, checkedRows = [rows];
            if (this.model().isValid(true, smwc.KEY_REIMAGE_VALIDATION)) {
                var serverAttrs = this.model().attributes,
                    putData = {}, servers = [];

                for (var i = 0; i < checkedRows.length; i++) {
                    servers.push({"id": checkedRows[i].id, "base_image_id": serverAttrs.base_image_id});
                }
                putData = servers;
                ajaxConfig.type = "POST";
                ajaxConfig.data = JSON.stringify(putData);
                ajaxConfig.timeout = smwc.TIMEOUT;
                ajaxConfig.url = smwc.URL_SERVER_REIMAGE;

                contrail.ajaxHandler(ajaxConfig, function () {
                    if (contrail.checkIfFunction(callbackObj.init)) {
                        callbackObj.init();
                    }
                }, function () {
                    if (contrail.checkIfFunction(callbackObj.success)) {
                        callbackObj.success();
                    }
                }, function (error) {
                    console.log(error);
                    if (contrail.checkIfFunction(callbackObj.error)) {
                        callbackObj.error(error);
                    }
                });
            } else {
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(this.getFormErrorText(smwc.SERVER_PREFIX_ID));
                }
            }
        },
        provision: function (rows, callbackObj) {
            var ajaxConfig = {}, checkedRows = [rows];
            if (this.model().isValid(true, smwc.KEY_PROVISION_VALIDATION)) {
                var serverAttrs = this.model().attributes,
                    putData = {}, servers = [];

                for (var i = 0; i < checkedRows.length; i++) {
                    servers.push({"id": checkedRows[i].id, "package_image_id": serverAttrs.package_image_id});
                }
                putData = servers;

                ajaxConfig.type = "POST";
                ajaxConfig.data = JSON.stringify(putData);
                ajaxConfig.timeout = smwc.TIMEOUT;
                ajaxConfig.url = smwc.URL_SERVER_PROVISION;

                contrail.ajaxHandler(ajaxConfig, function () {
                    if (contrail.checkIfFunction(callbackObj.init)) {
                        callbackObj.init();
                    }
                }, function () {
                    if (contrail.checkIfFunction(callbackObj.success)) {
                        callbackObj.success();
                    }
                }, function (error) {
                    console.log(error);
                    if (contrail.checkIfFunction(callbackObj.error)) {
                        callbackObj.error(error);
                    }
                });
            } else {
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(this.getFormErrorText(smwc.SERVER_PREFIX_ID));
                }
            }
        },
        deleteServer: function (checkedRow, callbackObj) {
            var ajaxConfig = {};
            ajaxConfig.type = "DELETE";
            // check if server to be deleted has a id else delete using mac address
            if(contrail.checkIfExist(checkedRow) && contrail.checkIfExist(checkedRow.id)) {
                ajaxConfig.url = smwc.URL_OBJ_SERVER_ID + checkedRow.id;
            } else if (contrail.checkIfExist(checkedRow) && contrail.checkIfExist(checkedRow.mac_address)){
                ajaxConfig.url = smwc.URL_OBJ_SERVER_MAC_ADDRESS + checkedRow.mac_address;
            }
            contrail.ajaxHandler(ajaxConfig, function () {
                if (contrail.checkIfFunction(callbackObj.init)) {
                    callbackObj.init();
                }
            }, function () {
                if (contrail.checkIfFunction(callbackObj.success)) {
                    callbackObj.success();
                }
            }, function (error) {
                console.log(error);
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(error);
                }
            });
        },
        addInterface: function(type) {
            var interfaces = this.model().attributes.interfaces;
            // ip_address is passed as null to avoid SM backend error
            var newInterface = new InterfaceModel({name: "", type: type, "ip_address" : null, "mac_address" : "", "default_gateway" : "", "dhcp" : true, member_interfaces: [], "tor" : "", "tor_port" : ""});
            interfaces.add([newInterface]);
        },
        deleteInterface: function(data, kbInterface) {
            var interfaceCollection = data.model().collection,
                intf = kbInterface.model();

            interfaceCollection.remove(intf);
        },
        addSwitch: function() {
            var switches = this.model().get("switches"),
                newSwitch = new SwitchModel({
                "switch_id"       : "",
                "ip_address"      : "",
                "switch_name"     : "",
                "ovs_port"        : "",
                "ovs_protocol"    : "",
                "http_server_port": "",
                "vendor_name"     : "",
                "product_name"    : "",
                "keepalive_time"  : ""
            });
            switches.add(newSwitch);
        },
        deleteSwitch: function(data, kbSwitch) {
            var switchCollection = data.model().collection,
                swth = kbSwitch.model();

            switchCollection.remove(swth);
        },
        addRoute: function() {
            var routes = this.model().get("routes"),
                newRoute = new RoutesModel({
                    "network"   : "",
                    "netmask"   : "",
                    "gateway"   : "",
                    "interface" : ""
                });
            routes.add(newRoute);
        },
        deleteRoute: function(data, kbRoute) {
            var routeCollection = data.model().collection,
                swth = kbRoute.model();

            routeCollection.remove(swth);
        },
        filterInterfaces: function(interfaceType) {
            return Knockout.computed(function () {
                var kbInterfaces = this.interfaces(),
                    interfaces = this.model().attributes.interfaces,
                    filteredInterfaces = [], model, type;

                for (var i = 0; i < interfaces.length; i++) {
                    model = interfaces.at(i);
                    type = contrail.checkIfExist(model.attributes.type()) ? model.attributes.type() : smwc.INTERFACE_TYPE_PHYSICAL;

                    if (type == interfaceType) {
                        filteredInterfaces.push(kbInterfaces[i]);
                    }
                }
                return filteredInterfaces;
            }, this);
        },
        getMemberInterfaces: function() {
            return Knockout.computed(function () {
                this.interfaces();
                var interfaces = this.model().attributes.interfaces,
                    memberInterfaces = [], model, dhcp, interfaceType = "";
                for (var i = 0; i < interfaces.length; i++) {
                    model = interfaces.at(i);
                    dhcp = model.attributes.dhcp();
                    interfaceType = model.attributes.type();
                    if (dhcp != true && model.attributes.name() != "" && (interfaceType !== "bond")) {
                        memberInterfaces.push(model.attributes.name());
                    }
                }
                return memberInterfaces;
            }, this);
        },
        getParentInterfaces: function() {
            return Knockout.computed(function () {
                this.interfaces();
                var interfaces = this.model().attributes.interfaces,
                    parentInterfaces = [], model, type;
                for (var i = 0; i < interfaces.length; i++) {
                    model = interfaces.at(i);
                    type = model.attributes.type();
                    if ((type == smwc.INTERFACE_TYPE_PHYSICAL || type == smwc.INTERFACE_TYPE_BOND) && model.attributes.name() !== "") {
                        parentInterfaces.push(model.attributes.name());
                    }
                }
                return parentInterfaces;
            }, this);
        },
        getManagementInterfaces: function() {
            return Knockout.computed(function () {
                this.interfaces();
                var interfaces = this.model().attributes.interfaces,
                    managementInterfaces = [], model, type;

                for (var i = 0; i < interfaces.length; i++) {
                    model = interfaces.at(i);
                    type = contrail.checkIfExist(model.attributes.type()) ? model.attributes.type() : smwc.INTERFACE_TYPE_PHYSICAL;

                    if (type == smwc.INTERFACE_TYPE_PHYSICAL && model.attributes.name() !== "") {
                        managementInterfaces.push(model.attributes.name());
                    }
                }
                return managementInterfaces;
            }, this);
        },
        getControlDataInterfaces: function() {
            return Knockout.computed(function () {
                this.interfaces();
                var interfaces = this.model().attributes.interfaces,
                    controlDataInterfaces = [], model;

                for (var i = 0; i < interfaces.length; i++) {
                    model = interfaces.at(i);
                    if(model.attributes.name() != "") {
                        controlDataInterfaces.push(model.attributes.name());
                    }
                }

                return controlDataInterfaces;
            }, this);
        },
        runInventory: function (checkedRow, callbackObj) {
            var ajaxConfig = {},
                serverId = checkedRow.id;

            ajaxConfig.type = "POST";
            ajaxConfig.url = smwc.URL_RUN_INVENTORY + "?id=" +serverId;

            contrail.ajaxHandler(ajaxConfig, function () {
                if (contrail.checkIfFunction(callbackObj.init)) {
                    callbackObj.init();
                }
            }, function () {
                if (contrail.checkIfFunction(callbackObj.success)) {
                    callbackObj.success();
                }
            }, function (error) {
                console.log(error);
                if (contrail.checkIfFunction(callbackObj.error)) {
                    callbackObj.error(error);
                }
            });
        },

        validations: {
            reimageValidation: {
                "base_image_id": {
                    required: true,
                    msg: smwm.getRequiredMessage("base_image_id")
                }
            },
            provisionValidation: {
                "package_image_id": {
                    required: true,
                    msg: smwm.getRequiredMessage("package_image_id")
                }
            },
            configureValidation: {
                "id": {
                    required: true,
                    msg: smwm.getRequiredMessage("id")
                },
                "network.management_interface": {
                    required: true,
                    msg: smwm.getRequiredMessage("management_interface")
                },
                "ipmi_address": {
                    required: true,
                    pattern: cowc.PATTERN_IP_ADDRESS,
                    msg: smwm.getInvalidErrorMessage("ipmi_address")
                },
                "password": {
                    required: true,
                    msg: smwm.getInvalidErrorMessage("password")
                },
                "email": {
                    required: false,
                    pattern: "email",
                    msg: smwm.getInvalidErrorMessage("email")
                }
            },
            editTagsValidation: {}
        }
    });

    return ServerModel;
});
