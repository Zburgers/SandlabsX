# syntax=docker/dockerfile:1.7
ARG GUACAMOLE_VERSION=1.5.4

FROM guacamole/guacamole:${GUACAMOLE_VERSION} AS guacamole

FROM postgres:16

# Guacamole 1.5.x's initdb.sh reads PostgreSQL schema files from this path.
# Keep this version-specific source coupled to GUACAMOLE_VERSION and revalidate
# it before upgrading to a release with a different image layout.
COPY --from=guacamole \
  /opt/guacamole/postgresql/schema \
  /guacamole-schema
COPY guacamole-db-init.sh /usr/local/bin/guacamole-db-init.sh

RUN chmod 0755 /usr/local/bin/guacamole-db-init.sh \
  && test -s /guacamole-schema/001-create-schema.sql

ENV GUACAMOLE_SCHEMA_DIR=/guacamole-schema
ENTRYPOINT ["/usr/local/bin/guacamole-db-init.sh"]
