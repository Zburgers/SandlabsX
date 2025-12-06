const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'SandBoxLabs API',
            version: '1.0.0',
            description: 'RESTful API for managing QEMU VM nodes with overlay disks and Guacamole integration.',
            contact: {
                name: 'SandBoxLabs Team'
            }
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token'
                }
            },
            schemas: {
                Node: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        osType: { type: 'string', enum: ['ubuntu', 'debian', 'alpine', 'router', 'custom'] },
                        status: { type: 'string', enum: ['created', 'running', 'stopped', 'error'] },
                        overlayPath: { type: 'string' },
                        vncPort: { type: 'integer', nullable: true },
                        guacUrl: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Image: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        path: { type: 'string' },
                        format: { type: 'string' },
                        sizeBytes: { type: 'integer' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string' }
                    }
                }
            }
        },
        security: [{ bearerAuth: [] }],
        paths: {
            '/api/health': {
                get: {
                    summary: 'Health check',
                    description: 'Returns server status and connection info. Public endpoint (no auth required).',
                    tags: ['Health'],
                    security: [],
                    responses: {
                        '200': {
                            description: 'Server is healthy',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string', example: 'healthy' },
                                            timestamp: { type: 'string', format: 'date-time' },
                                            version: { type: 'string' },
                                            services: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/nodes': {
                get: {
                    summary: 'List all nodes',
                    description: 'Returns array of all nodes with current status.',
                    tags: ['Nodes'],
                    responses: {
                        '200': {
                            description: 'List of nodes',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            nodes: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/Node' }
                                            },
                                            count: { type: 'integer' }
                                        }
                                    }
                                }
                            }
                        },
                        '401': { description: 'Unauthorized' }
                    }
                },
                post: {
                    summary: 'Create a new node',
                    description: 'Creates a new VM node with QCOW2 overlay.',
                    tags: ['Nodes'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string', example: 'my-node' },
                                        osType: { type: 'string', enum: ['ubuntu', 'debian', 'alpine', 'router', 'custom'], example: 'ubuntu' },
                                        resources: {
                                            type: 'object',
                                            properties: {
                                                ram: { type: 'integer', example: 2048 },
                                                cpus: { type: 'integer', example: 2 }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '201': {
                            description: 'Node created',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/Node' }
                                }
                            }
                        },
                        '400': { description: 'Invalid input' },
                        '401': { description: 'Unauthorized' }
                    }
                }
            },
            '/api/nodes/{id}': {
                get: {
                    summary: 'Get node details',
                    description: 'Returns detailed information about a specific node.',
                    tags: ['Nodes'],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                    ],
                    responses: {
                        '200': {
                            description: 'Node details',
                            content: {
                                'application/json': { schema: { $ref: '#/components/schemas/Node' } }
                            }
                        },
                        '404': { description: 'Node not found' },
                        '401': { description: 'Unauthorized' }
                    }
                },
                delete: {
                    summary: 'Delete a node',
                    description: 'Stops VM, deletes overlay, and removes from state.',
                    tags: ['Nodes'],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                    ],
                    responses: {
                        '200': { description: 'Node deleted' },
                        '404': { description: 'Node not found' },
                        '401': { description: 'Unauthorized' }
                    }
                }
            },
            '/api/nodes/{id}/run': {
                post: {
                    summary: 'Start a node',
                    description: 'Boots the QEMU VM and registers with Guacamole.',
                    tags: ['Nodes'],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                    ],
                    responses: {
                        '200': {
                            description: 'Node started',
                            content: {
                                'application/json': { schema: { $ref: '#/components/schemas/Node' } }
                            }
                        },
                        '400': { description: 'Node already running' },
                        '404': { description: 'Node not found' },
                        '401': { description: 'Unauthorized' }
                    }
                }
            },
            '/api/nodes/{id}/stop': {
                post: {
                    summary: 'Stop a node',
                    description: 'Gracefully shuts down the QEMU VM.',
                    tags: ['Nodes'],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                    ],
                    responses: {
                        '200': { description: 'Node stopped' },
                        '400': { description: 'Node not running' },
                        '404': { description: 'Node not found' },
                        '401': { description: 'Unauthorized' }
                    }
                }
            },
            '/api/nodes/{id}/wipe': {
                post: {
                    summary: 'Wipe a node',
                    description: 'Deletes overlay and recreates from base image.',
                    tags: ['Nodes'],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                    ],
                    responses: {
                        '200': { description: 'Node wiped' },
                        '404': { description: 'Node not found' },
                        '401': { description: 'Unauthorized' }
                    }
                }
            },
            '/api/nodes/{id}/configure-router': {
                post: {
                    summary: 'Configure router',
                    description: 'Auto-configures a Cisco router with network settings.',
                    tags: ['Nodes'],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
                    ],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        hostname: { type: 'string' },
                                        interfaces: { type: 'array', items: { type: 'object' } }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '200': { description: 'Configuration sent' },
                        '400': { description: 'Node is not a router or not running' },
                        '404': { description: 'Node not found' },
                        '401': { description: 'Unauthorized' }
                    }
                }
            },
            '/api/images': {
                get: {
                    summary: 'List available images',
                    description: 'Returns catalogue of base and custom images.',
                    tags: ['Images'],
                    responses: {
                        '200': {
                            description: 'Image catalogue',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            baseImages: { type: 'array', items: { $ref: '#/components/schemas/Image' } },
                                            customImages: { type: 'array', items: { $ref: '#/components/schemas/Image' } }
                                        }
                                    }
                                }
                            }
                        },
                        '401': { description: 'Unauthorized' }
                    }
                }
            },
            '/api/images/custom': {
                post: {
                    summary: 'Upload custom image',
                    description: 'Uploads a QCOW2/VMDK/VDI image (max 20GB).',
                    tags: ['Images'],
                    requestBody: {
                        required: true,
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        image: { type: 'string', format: 'binary' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '201': { description: 'Image uploaded' },
                        '400': { description: 'Invalid file format' },
                        '401': { description: 'Unauthorized' }
                    }
                }
            }
        }
    },
    apis: []
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
