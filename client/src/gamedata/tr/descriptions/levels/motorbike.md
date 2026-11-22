Ethernaut’un motorbike'ının yepyeni, yükseltilebilir bir motor tasarımı var.

Bu motoru `selfdestruct` ile yok edip motorbike'ı kullanılamaz hâle getirebilir misin?

Yardımcı olabilecek noktalar:

- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967)
- [UUPS](https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786) upgradeable (yükseltilebilir) pattern
- [Initializable](https://github.com/OpenZeppelin/openzeppelin-upgrades/blob/master/packages/core/contracts/Initializable.sol) kontratı

Not: Cancun yükseltmesinden beri [EIP-6780](https://eips.ethereum.org/EIPS/eip-6780) `selfdestruct` davranışını değiştirdi. Artık kontrat kodunu yalnızca kontratı oluşturan işlemin içinde çalıştığında siler. Motoru daha sonraki bir işlemde yok edersen kodu yerinde kalır ve seviye tamamlanmaz. Seviye bu kurallar içinde yine de çözülebilir, bu yüzden tek bir işlem içinde neler yapabileceğini düşün.
