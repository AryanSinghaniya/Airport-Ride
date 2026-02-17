const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Smart Airport Ride Pooling API',
        version: '1.0.0',
        description: 'API for grouping airport passengers into shared cabs'
    },
    servers: [
        {
            url: 'http://localhost:5000/api/v1',
            description: 'Local server'
        }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        }
    },
    security: [
        {
            bearerAuth: []
        }
    ],
    paths: {
        '/auth/register': {
            post: {
                summary: 'Register a new passenger',
                tags: ['Auth'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    email: { type: 'string' },
                                    password: { type: 'string' },
                                    phone: { type: 'string' },
                                    defaultTerminal: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Registered successfully' }
                }
            }
        },
        '/auth/login': {
            post: {
                summary: 'Login passenger',
                tags: ['Auth'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    email: { type: 'string' },
                                    password: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Logged in successfully' }
                }
            }
        },
        '/rides/request': {
            post: {
                summary: 'Request a ride',
                tags: ['Rides'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    pickupLocation: {
                                        type: 'object',
                                        properties: {
                                            type: { type: 'string', example: 'Point' },
                                            coordinates: { type: 'array', items: { type: 'number' }, example: [-73.935242, 40.730610] }
                                        }
                                    },
                                    terminal: { type: 'string' },
                                    luggageCount: { type: 'number' },
                                    seatsNeeded: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '202': { description: 'Ride request accepted for processing' }
                }
            }
        }
    }
};

module.exports = swaggerDocument;
