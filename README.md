Web interface for Single Board Computers (e.g. Raspberry Pi).

# Setup

The recommended method is to clone off github.

You will need [CouchDB](https://couchdb.apache.org/).

Copy `config.yaml.example` to `config.yaml`, and modify the contents to suit. 
Create a user for CouchDB and put its credentials in the username/password part 
of the config.

If you intend to run the tests, the CouchDB user will need to be an admin, since
the tests create new databases on the fly. Otherwise, a regular user will do.
