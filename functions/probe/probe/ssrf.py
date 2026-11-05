"""The SSRF guard (system-design.md §8): resolve, refuse private, loopback,
link-local, CGNAT, NAT64, metadata and IPv6 ULA addresses, and connect only to an
address that passed. Every redirect hop goes through here again.

Self-host may allow private targets (PROBE_ALLOW_PRIVATE=true); cloud never.
"""

import ipaddress
import os
import socket
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

_CGNAT = ipaddress.ip_network("100.64.0.0/10")
_NAT64 = ipaddress.ip_network("64:ff9b::/96")
_ULA = ipaddress.ip_network("fc00::/7")
_METADATA = {ipaddress.ip_address("169.254.169.254"), ipaddress.ip_address("fd00:ec2::254")}


class Blocked(Exception):
    """The target resolves to an address the probe may not reach."""


class Unresolvable(Exception):
    """DNS gave no address."""


class ResolveTimeout(Exception):
    """DNS did not answer within the check's remaining time."""


_RESOLVER = ThreadPoolExecutor(max_workers=16, thread_name_prefix="resolve")


def allow_private() -> bool:
    return os.environ.get("PROBE_ALLOW_PRIVATE", "").lower() == "true"


def address_allowed(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    if addr in _METADATA:
        return False  # never, not even in self-host
    if allow_private():
        return True
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
        or addr in _CGNAT
        or (addr.version == 6 and (addr in _ULA or addr in _NAT64))
    )


def resolve(url: str, timeout_s: float | None = None) -> tuple[str, int, str]:
    """Return (host, port, ip) for url, with ip the first allowed address.
    Every address must be allowed: a name that mixes public and private
    answers is refused (rebinding defence). getaddrinfo has no timeout of
    its own, so it runs on a worker and the wait is capped at timeout_s."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise Blocked("only http(s) URLs")
    if parts.username or parts.password:
        raise Blocked("credentials in URLs are refused")
    port = parts.port or (443 if parts.scheme == "https" else 80)
    pending = _RESOLVER.submit(socket.getaddrinfo, parts.hostname, port, type=socket.SOCK_STREAM)
    try:
        infos = pending.result(timeout=timeout_s)
    except TimeoutError as e:
        pending.cancel()
        raise ResolveTimeout(parts.hostname) from e
    except (socket.gaierror, UnicodeError) as e:
        raise Unresolvable(str(e)) from e
    ips = list(dict.fromkeys(info[4][0] for info in infos))
    if not ips:
        raise Unresolvable("no address")
    for ip in ips:
        if not address_allowed(ip):
            raise Blocked(f"{parts.hostname} resolves to a disallowed address")
    return parts.hostname, port, ips[0]
