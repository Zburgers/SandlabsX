# syntax=docker/dockerfile:1.7
ARG GUACAMOLE_VERSION=1.5.4

FROM guacamole/guacamole:${GUACAMOLE_VERSION} AS guacamole

FROM postgres:16

COPY --from=guacamole \
  /opt/guacamole/extensions/guacamole-auth-jdbc/postgresql/schema \
  /guacamole-schema
COPY guacamole-db-init.sh /usr/local/bin/guacamole-db-init.sh

RUN chmod 0755 /usr/local/bin/guacamole-db-init.sh \
  && test -s /guacamole-schema/001-create-schema.sql

ENV GUACAMOLE_SCHEMA_DIR=/guacamole-schema
ENTRYPOINT ["/usr/local/bin/guacamole-db-init.sh"]
